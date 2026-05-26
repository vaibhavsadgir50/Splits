'use client'

import { useState, useEffect } from 'react'

export default function HistoryPanel({ onClose }) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  function loadHistory() {
    setLoading(true)
    fetch('/api/history')
      .then((r) => r.json())
      .then(setReceipts)
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadHistory() }, [])

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim()) { setSearchResults(null); return }
    setSearching(true)
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })
      setSearchResults(await res.json())
    } catch {
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleDelete(receipt) {
    if (!confirm(`Delete "${receipt.store_name || receipt.receipt_code}"? This cannot be undone.`)) return
    setDeletingId(receipt.id)
    try {
      const res = await fetch(`/api/history?id=${receipt.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setReceipts((prev) => prev.filter((r) => r.id !== receipt.id))
      if (expandedId === receipt.id) setExpandedId(null)
    } catch {
      setError('Failed to delete receipt.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">History</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full clay-sm bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search past items…"
          className="flex-1 clay-inset bg-white/80 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={searching || !searchQuery.trim()}
          className="bg-brand-600 text-white px-5 py-3 rounded-2xl text-sm font-black clay-btn hover:bg-brand-700 disabled:opacity-50 transition"
        >
          {searching ? '…' : 'Search'}
        </button>
        {searchResults && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setSearchResults(null) }}
            className="px-4 py-3 rounded-2xl clay-sm bg-gray-100 text-sm font-semibold text-gray-500 hover:bg-gray-200 transition"
          >
            Clear
          </button>
        )}
      </form>

      {/* Search results */}
      {searchResults && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-400 px-1">
            Semantic matches
          </p>
          {searchResults.length === 0 ? (
            <div className="clay bg-white/80 rounded-3xl px-5 py-6 text-center">
              <p className="text-gray-400 text-sm font-medium">No matching items found.</p>
            </div>
          ) : (
            <div className="clay bg-white/90 rounded-3xl overflow-hidden">
              {searchResults.map((r, i) => (
                <div key={i} className={`flex items-center justify-between px-5 py-3 ${i < searchResults.length - 1 ? 'border-b border-brand-50' : ''}`}>
                  <div>
                    <span className="font-semibold text-gray-900 text-sm">{r.item_name}</span>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {r.receipt_code} · {new Date(r.purchased_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-xl clay-sm">
                      {Math.round(r.similarity * 100)}%
                    </span>
                    <span className="font-black text-gray-900">${parseFloat(r.price).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="clay-inset bg-red-50 rounded-2xl px-4 py-3">
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-7 h-7 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && receipts.length === 0 && !error && (
        <div className="clay bg-white/80 rounded-3xl px-6 py-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 font-medium">No history yet. Upload a receipt to get started.</p>
        </div>
      )}

      <div className="space-y-3">
        {receipts.map((receipt) => {
          const isExpanded = expandedId === receipt.id
          const isDeleting = deletingId === receipt.id
          const total = receipt.items?.reduce((s, i) => s + (parseFloat(i.price) || 0), 0) ?? 0
          const personTotals = {}
          receipt.items?.forEach((item) => {
            const perPerson = parseFloat(item.per_person_amt) || 0
            ;(item.split_with || []).forEach((p) => {
              personTotals[p] = (personTotals[p] || 0) + perPerson
            })
          })

          return (
            <div key={receipt.id} className={`clay bg-white/90 rounded-3xl overflow-hidden transition-all`}>
              {/* Header row */}
              <div className="flex items-center gap-2 px-4 py-4">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <span className={`w-7 h-7 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 clay-sm flex items-center justify-center text-white text-xs font-black flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`}>
                    +
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 truncate">
                      {receipt.store_name || receipt.receipt_code}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(receipt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}<span className="font-medium">{receipt.paid_by}</span>
                      {receipt.store_name && <span className="ml-1 font-mono text-gray-300">#{receipt.receipt_code}</span>}
                    </p>
                  </div>
                  <span className="font-black text-gray-900 flex-shrink-0">${total.toFixed(2)}</span>
                </button>

                <button
                  onClick={() => handleDelete(receipt)}
                  disabled={isDeleting}
                  className="w-8 h-8 rounded-xl clay-sm bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 disabled:opacity-40 transition flex-shrink-0"
                  title="Delete receipt"
                >
                  {isDeleting ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Expanded items */}
              {isExpanded && (
                <div className="mx-4 mb-4 clay-inset bg-brand-50/40 rounded-2xl overflow-hidden">
                  <div className="divide-y divide-white/60">
                    {receipt.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-gray-800 font-medium">{item.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-400 text-xs">{(item.split_with || []).join(', ')}</span>
                          <span className="font-bold text-gray-900 w-14 text-right">
                            ${parseFloat(item.price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-white/60 flex flex-wrap items-center gap-3">
                    {Object.entries(personTotals).map(([person, amt]) => (
                      <span key={person} className="text-xs clay-sm bg-white px-2.5 py-1 rounded-xl font-semibold text-brand-700">
                        {person}: ${amt.toFixed(2)}
                      </span>
                    ))}
                  </div>
                  {receipt.notes && (
                    <div className="px-4 pb-3 text-xs text-gray-400 font-medium">{receipt.notes}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
