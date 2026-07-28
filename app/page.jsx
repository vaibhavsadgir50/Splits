'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import HomePage from '@/components/HomePage'
import GetStartedModal from '@/components/GetStartedModal'
import Header from '@/components/Header'
import { AvatarProvider } from '@/contexts/AvatarContext'

export default function Page() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState(null)
  const [ledgers, setLedgers] = useState([])
  const [authLoading, setAuthLoading] = useState(true)
  const [showAddLedger, setShowAddLedger] = useState(false)

  const loadAuth = useCallback(() => {
    setAuthLoading(true)
    return fetch('/api/auth')
      .then((r) => r.json())
      .then(({ user, ledgers: lgs }) => {
        setAuthUser(user)
        setLedgers(lgs ?? [])
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => { loadAuth() }, [loadAuth])

  function handleLedgerReady(result) {
    router.push(`/account/${result.ledger_id}`)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-on-surface/15 border-t-on-surface rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AvatarProvider ledgerId={null}>
      <div className="min-h-screen flex flex-col relative">
        <Header avatarName={authUser?.name || authUser?.email} ledgerId={null} />

        {ledgers.length === 0 && (
          <GetStartedModal googleName={authUser?.name} dismissable={false} onDone={handleLedgerReady} />
        )}

        {ledgers.length > 0 && (
          <HomePage
            ledgers={ledgers}
            userEmail={authUser?.email}
            onEnterLedger={(id) => router.push(`/account/${id}`)}
            onAddLedger={() => setShowAddLedger(true)}
          />
        )}

        {showAddLedger && (
          <GetStartedModal
            googleName={authUser?.name}
            dismissable
            onClose={() => setShowAddLedger(false)}
            onDone={handleLedgerReady}
          />
        )}
      </div>
    </AvatarProvider>
  )
}
