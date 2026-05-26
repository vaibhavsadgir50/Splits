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

export default function App() {
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [view, setView] = useState('home')
  const [step, setStep] = useState(null)
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0)

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
    setItems(parsed.map((i) => ({ name: i.name, price: i.price ?? 0 })))
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

  function handleManual() {
    setReceiptId(`MAN-${Date.now()}`)
    setStoreName('')
    setItems([{ name: '', price: 0 }])
    setAssignments({ 0: new Set(members) })
    setStep('review')
  }

  const showReview = step === 'review'
  const showSummary = step === 'summary'
  const showUploadModal = step === 'upload'

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/60">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <button
            onClick={() => { setView('home'); setStep(null) }}
            className="flex items-center gap-3 hover:opacity-80 transition"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 clay-sm flex items-center justify-center">
              <span className="text-white font-black text-xs tracking-tight">SP</span>
            </div>
            <span className="text-xl font-black tracking-widest bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              SPLITS
            </span>
          </button>

          <div className="flex gap-2 items-center">
            <button
              onClick={() => { setView(view === 'history' ? 'home' : 'history'); setStep(null) }}
              className={`text-sm px-4 py-2 rounded-2xl font-semibold transition ${
                view === 'history'
                  ? 'bg-gray-800 text-white clay-sm'
                  : 'bg-white/70 text-gray-600 hover:bg-white clay-sm'
              }`}
            >
              History
            </button>
            <button
              onClick={() => { setView(view === 'members' ? 'home' : 'members'); setStep(null) }}
              className={`text-sm px-4 py-2 rounded-2xl font-semibold transition ${
                view === 'members'
                  ? 'bg-brand-600 text-white clay-btn'
                  : 'bg-brand-100 text-brand-700 hover:bg-brand-200 clay-sm'
              }`}
            >
              Members ({members.length})
            </button>

            {/* User avatar + sign-out */}
            {authUser && (
              <button
                onClick={handleSignOut}
                title={`Signed in as ${authUser.email}\nClick to sign out`}
                className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 clay-sm flex items-center justify-center text-white font-black text-xs"
              >
                {(memberName || authUser.name || authUser.email)?.[0]?.toUpperCase() ?? '?'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ReviewStep — full page */}
      {showReview && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
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
        <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8">
          <SummaryStep summary={summary} receiptId={receiptId} onReset={handleReset} />
        </main>
      )}

      {!showReview && !showSummary && (
        <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8">
          {view === 'members' ? (
            <MembersPanel members={members} onChanged={loadMembers} onClose={() => setView('home')} />
          ) : view === 'history' ? (
            <HistoryPanel onClose={() => setView('home')} />
          ) : (
            <BalancesView
              members={members}
              onUpload={() => setStep('upload')}
              refreshKey={balanceRefreshKey}
            />
          )}
        </main>
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 bg-brand-900/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setStep(null) }}
        >
          <div className="bg-white/90 rounded-4xl w-full max-w-sm clay">
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
    </div>
  )
}
