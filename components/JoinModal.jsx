'use client'

import { useState } from 'react'
import Avatar from './Avatar'

export default function JoinModal({ ledgerId, ledgerName, members, googleName, onJoined, onCancel }) {
  const [mode, setMode] = useState(members.length > 0 ? 'pick' : 'create')
  const [selected, setSelected] = useState('')
  const [newName, setNewName] = useState(googleName || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    const name = mode === 'create' ? newName.trim() : selected
    if (!name) { setError('Choose or enter a name'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ledgers/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledger_id: ledgerId, memberName: name, createNew: mode === 'create' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onJoined(data)
    } catch (err) {
      setError(err.message || 'Failed to join. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-on-surface/20 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="glass-shard rounded-3xl w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 mx-auto glass-shard rounded-full flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-2xl text-on-surface/75">house</span>
          </div>
          <h2 className="font-display-lg text-2xl text-on-surface">Who are you?</h2>
          <p className="text-on-surface/75 text-sm">
            Link your Google account to your name in {ledgerName ? <strong>{ledgerName}</strong> : 'this account'} so we know where to send your receipts.
          </p>
        </div>

        {/* Tab toggle */}
        <div className="glass-shard rounded-full p-1 flex">
          <button
            onClick={() => setMode('pick')}
            className={`flex-1 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition ${mode === 'pick' ? 'bg-on-surface text-white' : 'text-on-surface/75'}`}
          >
            Already a member
          </button>
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition ${mode === 'create' ? 'bg-on-surface text-white' : 'text-on-surface/75'}`}
          >
            Add me new
          </button>
        </div>

        {mode === 'pick' ? (
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-on-surface/65 text-sm text-center py-4">No members yet — switch to "Add me new".</p>
            ) : (
              members.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelected(name)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-full font-semibold text-sm text-left transition ${
                    selected === name
                      ? 'bg-on-surface text-white'
                      : 'glass-shard text-on-surface hover:scale-[1.01]'
                  }`}
                >
                  <Avatar name={name} size="sm" />
                  {name}
                </button>
              ))
            )}
          </div>
        ) : (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Your name (e.g. Alex)"
            className="w-full glass-shard rounded-full px-4 py-3 text-sm font-semibold focus:outline-none placeholder:text-on-surface/55"
          />
        )}

        {error && <p className="font-mono text-xs text-red-500">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={loading || (mode === 'pick' && !selected) || (mode === 'create' && !newName.trim())}
          className="w-full py-3.5 rounded-full bg-on-surface text-white font-mono text-[11px] uppercase tracking-widest disabled:opacity-40 transition"
        >
          {loading ? 'Joining…' : 'Join Account'}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full font-mono text-[10px] uppercase tracking-widest text-on-surface/50 hover:text-on-surface transition"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  )
}
