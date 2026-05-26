'use client'

import { useState } from 'react'

export default function JoinModal({ members, googleName, onJoined }) {
  const [mode, setMode] = useState('pick')        // 'pick' | 'create'
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
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberName: name, createNew: mode === 'create' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onJoined(data.member)
    } catch (err) {
      setError(err.message || 'Failed to join. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="clay bg-white/95 rounded-4xl w-full max-w-sm p-7 space-y-6">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-2">🏠</div>
          <h2 className="text-xl font-black text-gray-900">Who are you?</h2>
          <p className="text-gray-500 text-sm">Link your Google account to your household name so we know where to send your receipts.</p>
        </div>

        {/* Tab toggle */}
        <div className="clay-inset bg-brand-50 rounded-2xl p-1 flex">
          <button
            onClick={() => setMode('pick')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${mode === 'pick' ? 'clay bg-white text-brand-700' : 'text-gray-500'}`}
          >
            I'm already a member
          </button>
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${mode === 'create' ? 'clay bg-white text-brand-700' : 'text-gray-500'}`}
          >
            Add me new
          </button>
        </div>

        {mode === 'pick' ? (
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No members yet — switch to "Add me new".</p>
            ) : (
              members.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelected(name)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm text-left transition ${
                    selected === name
                      ? 'clay bg-brand-600 text-white'
                      : 'clay-sm bg-brand-50 text-gray-800 hover:bg-brand-100'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${selected === name ? 'bg-white/20 text-white' : 'bg-brand-200 text-brand-700'}`}>
                    {name[0].toUpperCase()}
                  </span>
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
            className="w-full clay-inset bg-brand-50 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none placeholder:text-gray-400"
          />
        )}

        {error && (
          <div className="clay-inset bg-red-50 rounded-2xl px-4 py-2">
            <p className="text-red-500 text-sm font-medium">{error}</p>
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || (mode === 'pick' && !selected) || (mode === 'create' && !newName.trim())}
          className="w-full py-3.5 rounded-2xl bg-brand-600 text-white font-black clay-btn disabled:opacity-50 transition"
        >
          {loading ? 'Joining…' : 'Join Household'}
        </button>
      </div>
    </div>
  )
}
