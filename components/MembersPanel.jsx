'use client'

import { useState } from 'react'

export default function MembersPanel({ members, onChanged, onClose }) {
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/members?name=${encodeURIComponent(name)}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewName('')
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(name) {
    if (!confirm(`Remove ${name} from the household?`)) return
    try {
      await fetch(`/api/members/${encodeURIComponent(name)}`, { method: 'DELETE' })
      await onChanged()
    } catch {
      setError('Failed to remove member')
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Members</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full clay-sm bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="clay bg-white/90 rounded-3xl overflow-hidden">
        {members.length === 0 && (
          <div className="px-6 py-10 text-center">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-gray-400 text-sm font-medium">No members yet — add some below.</p>
          </div>
        )}
        {members.map((name, i) => (
          <div
            key={name}
            className={`flex items-center justify-between px-5 py-4 ${i < members.length - 1 ? 'border-b border-brand-50' : ''}`}
          >
            <div className="flex items-center gap-3.5">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 clay-sm flex items-center justify-center text-white text-sm font-black">
                {name[0].toUpperCase()}
              </span>
              <span className="font-semibold text-gray-900">{name}</span>
            </div>
            <button
              onClick={() => handleRemove(name)}
              className="text-sm px-3 py-1.5 rounded-xl clay-sm bg-red-50 text-red-500 font-semibold hover:bg-red-100 transition"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Member name (e.g. Alice)"
          className="flex-1 clay-inset bg-white/80 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={loading || !newName.trim()}
          className="bg-brand-600 text-white px-5 py-3 rounded-2xl text-sm font-black clay-btn hover:bg-brand-700 disabled:opacity-50 transition"
        >
          {loading ? '…' : 'Add'}
        </button>
      </form>

      {error && (
        <div className="clay-inset bg-red-50 rounded-2xl px-4 py-3">
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  )
}
