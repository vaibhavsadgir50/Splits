'use client'

import { useState } from 'react'
import JoinModal from './JoinModal'

export default function GetStartedModal({ googleName, dismissable = false, onClose, onDone }) {
  const [mode, setMode] = useState('create') // 'create' | 'join'

  const [ledgerName, setLedgerName] = useState('')
  const [memberName, setMemberName] = useState(googleName || '')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [code, setCode] = useState('')
  const [looking, setLooking] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [resolvedLedger, setResolvedLedger] = useState(null)

  async function handleCreate() {
    if (!ledgerName.trim() || !memberName.trim()) { setCreateError('Fill in both fields'); return }
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/ledgers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerName: ledgerName.trim(), memberName: memberName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onDone(data)
    } catch (err) {
      setCreateError(err.message || 'Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  async function handleLookup() {
    if (!code.trim()) { setJoinError('Enter an invite code'); return }
    setLooking(true)
    setJoinError('')
    try {
      const res = await fetch(`/api/ledgers/join?code=${encodeURIComponent(code.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResolvedLedger(data)
    } catch (err) {
      setJoinError(err.message || 'Could not find that account')
    } finally {
      setLooking(false)
    }
  }

  if (resolvedLedger) {
    return (
      <JoinModal
        ledgerId={resolvedLedger.ledger_id}
        ledgerName={resolvedLedger.ledger_name}
        members={resolvedLedger.members}
        googleName={googleName}
        onJoined={onDone}
        onCancel={() => setResolvedLedger(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-on-surface/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="glass-shard rounded-3xl w-full max-w-sm p-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="text-center flex-1">
            <div className="w-14 h-14 mx-auto glass-shard rounded-full flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-2xl text-on-surface/75">diversity_3</span>
            </div>
            <h2 className="font-display-lg text-2xl text-on-surface">Get Started</h2>
            <p className="text-on-surface/75 text-sm mt-1">Create a new account or join one with an invite code.</p>
          </div>
          {dismissable && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full glass-shard flex items-center justify-center text-on-surface/65 hover:text-on-surface transition flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Tab toggle */}
        <div className="glass-shard rounded-full p-1 flex">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition ${mode === 'create' ? 'bg-on-surface text-white' : 'text-on-surface/75'}`}
          >
            Create New
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition ${mode === 'join' ? 'bg-on-surface text-white' : 'text-on-surface/75'}`}
          >
            Join With Code
          </button>
        </div>

        {mode === 'create' ? (
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Account Name</label>
              <input
                value={ledgerName}
                onChange={(e) => setLedgerName(e.target.value)}
                placeholder="e.g. Our Household"
                className="mt-1 w-full glass-shard rounded-full px-4 py-3 text-sm font-semibold focus:outline-none placeholder:text-on-surface/55"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Your Name</label>
              <input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g. Alex"
                className="mt-1 w-full glass-shard rounded-full px-4 py-3 text-sm font-semibold focus:outline-none placeholder:text-on-surface/55"
              />
            </div>
            {createError && <p className="font-mono text-xs text-red-500">{createError}</p>}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-3.5 rounded-full bg-on-surface text-white font-mono text-[11px] uppercase tracking-widest disabled:opacity-40 transition"
            >
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Invite Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 81353F"
                className="mt-1 w-full glass-shard rounded-full px-4 py-3 text-sm font-semibold font-mono tracking-widest focus:outline-none placeholder:text-on-surface/55"
              />
            </div>
            {joinError && <p className="font-mono text-xs text-red-500">{joinError}</p>}
            <button
              onClick={handleLookup}
              disabled={looking}
              className="w-full py-3.5 rounded-full bg-on-surface text-white font-mono text-[11px] uppercase tracking-widest disabled:opacity-40 transition"
            >
              {looking ? 'Looking…' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
