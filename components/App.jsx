'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import BalancesView from './BalancesView'
import MembersPanel from './MembersPanel'
import UploadStep from './UploadStep'
import ReviewStep from './ReviewStep'
import SummaryStep from './SummaryStep'
import HistoryPanel from './HistoryPanel'
import JoinModal from './JoinModal'
import Avatar from './Avatar'
import ProfileModal from './ProfileModal'
import { AvatarProvider } from '@/contexts/AvatarContext'

export default function App() {
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [view, setView] = useState('home')
  const [step, setStep] = useState(null)
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0)
  const [showProfile, setShowProfile] = useState(false)

  // Auth
  const [authUser, setAuthUser] = useState(null)
  const [memberName, setMemberName] = useState(null)   // linked household name
  const [authLoading, setAuthLoading] = useState(true)
  const [showJoin, setShowJoin] = useState(false)

  // Receipt flow
  const [paidBy, setPaidBy] = useState('')
  const [receiptId, setReceiptId] = useState('')
  const [storeName, setStoreName] = useState('')
  const [items, setItems] = useState([])
  const [assignments, setAssignments] = useState({})
  const [summary, setSummary] = useState(null)

  // Load auth state on mount
  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then(({ user, member }) => {
        setAuthUser(user)
        setMemberName(member)
        if (user && !member) setShowJoin(true)
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await fetch('/api/members')
      const data = await res.json()
      setMembers(data)
      setPaidBy((prev) => prev || data[0] || '')
    } catch {
      // Supabase not connected yet
    } finally {
      setMembersLoading(false)
    }
  }, [])

  useEffect(() => { loadMembers() }, [loadMembers])

  async function handleSignOut() {
    await getBrowserSupabase().auth.signOut()
    window.location.href = '/login'
  }

  function handleParsed({ items: parsed, receipt_id, store_name }) {
    setReceiptId(receipt_id)
    setStoreName(store_name || '')
    setItems(parsed.map((i) => ({
      name: i.name,
      price: i.price ?? 0,
      confidence: i.confidence ?? 'high',
      category: i.category ?? 'other',
      image_url: i.image_url ?? null,
    })))
    const init = {}
    parsed.forEach((_, idx) => { init[idx] = new Set(members) })
    setAssignments(init)
    setStep('review')
  }

  function handleSubmitted(result) {
    setSummary(result)
    setStep('summary')
    setBalanceRefreshKey((k) => k + 1)
  }

  function handleReset() {
    setStep(null)
    setItems([])
    setAssignments({})
    setSummary(null)
    setReceiptId('')
    setStoreName('')
  }

  function handleManual({ storeName: manualStore = '', total: manualTotal = 0 } = {}) {
    setReceiptId(`MAN-${Date.now()}`)
    setStoreName(manualStore)
    setItems([{ name: '', price: Number(manualTotal) || 0 }])
    setAssignments({ 0: new Set(members) })
    setStep('review')
  }

  const showReview = step === 'review'
  const showSummary = step === 'summary'
  const showUploadModal = step === 'upload'

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-on-surface/15 border-t-on-surface rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AvatarProvider>
    <div className="min-h-screen flex flex-col relative">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 pt-safe px-6 mt-4">
        <div className="h-14 px-6 flex items-center justify-between glass-shard rounded-full max-w-lg mx-auto">
          <button
            onClick={() => { setView('home'); setStep(null) }}
            className="text-xl font-display-lg font-bold tracking-tight text-on-surface hover:opacity-70 transition"
          >
            Splits
          </button>

          {authUser && (
            <button
              onClick={() => setShowProfile(true)}
              title="Edit profile"
              className="hover:opacity-80 transition"
            >
              <Avatar name={memberName || authUser.name || authUser.email} size="xs" />
            </button>
          )}
        </div>
      </header>

      {/* ReviewStep — full page */}
      {showReview && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 pt-32 pb-16">
          <ReviewStep
            members={members}
            paidBy={paidBy}
            receiptId={receiptId}
            storeName={storeName}
            items={items}
            onItemsChange={setItems}
            assignments={assignments}
            onAssignmentsChange={setAssignments}
            onSubmitted={handleSubmitted}
            onBack={() => setStep('upload')}
            onDiscard={handleReset}
          />
        </main>
      )}

      {showSummary && (
        <main className="flex-1 max-w-lg w-full mx-auto px-6 pt-32 pb-16">
          <SummaryStep summary={summary} receiptId={receiptId} onReset={handleReset} />
        </main>
      )}

      {!showReview && !showSummary && (
        <>
          {view === 'members' ? (
            <MembersPanel members={members} onChanged={loadMembers} />
          ) : view === 'history' ? (
            <HistoryPanel />
          ) : (
            <BalancesView
              members={members}
              refreshKey={balanceRefreshKey}
              memberName={memberName || authUser?.name || authUser?.email}
            />
          )}
        </>
      )}

      {/* Upload — full-screen glass takeover */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 prism-bg overflow-y-auto">
          <UploadStep
            members={members}
            membersLoading={membersLoading}
            paidBy={paidBy}
            onPaidByChange={setPaidBy}
            onParsed={handleParsed}
            onManual={handleManual}
            onClose={() => setStep(null)}
          />
        </div>
      )}

      {/* Join modal — shown on first login before member is linked */}
      {showJoin && (
        <JoinModal
          members={members}
          googleName={authUser?.name}
          onJoined={(name) => {
            setMemberName(name)
            setShowJoin(false)
            loadMembers()
          }}
        />
      )}

      {/* Profile modal — avatar upload/removal + sign out */}
      {showProfile && (
        <ProfileModal
          memberName={memberName || authUser?.name || authUser?.email}
          onClose={() => setShowProfile(false)}
          onSignOut={handleSignOut}
        />
      )}

      {/* Fade scrolling content out before it reaches the floating nav/CTA */}
      {!showReview && !showSummary && !showUploadModal && (
        <div
          className="fixed bottom-0 inset-x-0 h-48 z-30 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.97) 45%, rgba(255,255,255,0) 100%)' }}
        />
      )}

      {/* Bottom navigation */}
      {!showReview && !showSummary && !showUploadModal && (
        <nav className="fixed bottom-8 inset-x-0 z-50 flex justify-center px-6">
          <div className="glass-shard flex items-center justify-between h-16 px-3 rounded-full w-full max-w-lg mx-auto">
            <button
              onClick={() => { setView('history'); setStep(null) }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-10 rounded-full transition-all ${
                view === 'history' ? 'text-on-surface' : 'text-on-surface/55 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span className="font-mono text-[7px] uppercase tracking-[0.15em]">History</span>
            </button>

            <button
              onClick={() => setStep('upload')}
              className="flex-shrink-0 w-16 h-16 -mt-8 rounded-full bg-on-surface text-white shadow-xl shadow-on-surface/30 flex flex-col items-center justify-center gap-0.5 ring-4 ring-white/70 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[26px]">qr_code_scanner</span>
              <span className="font-mono text-[6px] uppercase tracking-[0.15em]">Scan</span>
            </button>

            <button
              onClick={() => { setView('members'); setStep(null) }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-10 rounded-full transition-all ${
                view === 'members' ? 'text-on-surface' : 'text-on-surface/55 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">group</span>
              <span className="font-mono text-[7px] uppercase tracking-[0.15em]">Members</span>
            </button>
          </div>
        </nav>
      )}
    </div>
    </AvatarProvider>
  )
}
