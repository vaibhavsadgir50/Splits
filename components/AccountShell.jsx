'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AvatarProvider } from '@/contexts/AvatarContext'
import { AccountProvider, useAccount } from '@/contexts/AccountContext'
import Header from './Header'

function BottomNav({ ledgerId }) {
  const pathname = usePathname()
  const isMembers = pathname.endsWith('/members')
  const isHistory = pathname.endsWith('/history')

  return (
    <nav className="fixed bottom-8 inset-x-0 z-50 flex justify-center px-6">
      <div className="glass-shard flex items-center justify-between h-16 px-3 rounded-full w-full max-w-lg mx-auto">
        <Link
          href={`/account/${ledgerId}/history`}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-10 rounded-full transition-all ${
            isHistory ? 'text-on-surface' : 'text-on-surface/55 hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span className="font-mono text-[7px] uppercase tracking-[0.15em]">History</span>
        </Link>

        <Link
          href={`/account/${ledgerId}/scan`}
          className="flex-shrink-0 w-16 h-16 -mt-8 rounded-full bg-on-surface text-white shadow-xl shadow-on-surface/30 flex flex-col items-center justify-center gap-0.5 ring-4 ring-white/70 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[26px]">qr_code_scanner</span>
          <span className="font-mono text-[6px] uppercase tracking-[0.15em]">Scan</span>
        </Link>

        <Link
          href={`/account/${ledgerId}/members`}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-10 rounded-full transition-all ${
            isMembers ? 'text-on-surface' : 'text-on-surface/55 hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">group</span>
          <span className="font-mono text-[7px] uppercase tracking-[0.15em]">Members</span>
        </Link>
      </div>
    </nav>
  )
}

function AccountChrome({ ledgerId, modal, children }) {
  const { memberName } = useAccount()
  const pathname = usePathname()
  // Scan and Review are full-bleed, immersive screens — same as the old
  // single-page app's "takeover" steps — so the persistent chrome hides.
  const isImmersive = pathname.endsWith('/review') || pathname.endsWith('/scan')

  return (
    <div className="min-h-screen flex flex-col relative">
      {!isImmersive && <Header avatarName={memberName} ledgerId={ledgerId} />}
      {children}
      {/* Next.js preserves a parallel route slot's last-rendered content
          during a soft client-side navigation that doesn't explicitly
          re-match that slot (e.g. pushing from the scan modal to /review).
          Gate it on the current pathname ourselves so it actually
          disappears once we've navigated away from /scan. */}
      {pathname.endsWith('/scan') ? modal : null}
      {!isImmersive && (
        <div
          className="fixed bottom-0 inset-x-0 h-48 z-30 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.97) 45%, rgba(255,255,255,0) 100%)' }}
        />
      )}
      {!isImmersive && <BottomNav ledgerId={ledgerId} />}
    </div>
  )
}

export default function AccountShell({ ledgerId, modal, children }) {
  const router = useRouter()
  const [resolved, setResolved] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth')
      .then((r) => r.json())
      .then(({ ledgers }) => {
        if (cancelled) return
        const match = (ledgers ?? []).find((l) => l.ledger_id === ledgerId)
        if (!match) {
          router.replace('/')
          return
        }
        setResolved(match)
      })
      .catch(() => { if (!cancelled) router.replace('/') })
    return () => { cancelled = true }
  }, [ledgerId, router])

  if (!resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-on-surface/15 border-t-on-surface rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AvatarProvider ledgerId={ledgerId}>
      <AccountProvider ledgerId={ledgerId} initialLedgerName={resolved.ledger_name} memberName={resolved.member_name}>
        <AccountChrome ledgerId={ledgerId} modal={modal}>{children}</AccountChrome>
      </AccountProvider>
    </AvatarProvider>
  )
}
