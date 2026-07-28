'use client'

import { useState, useEffect } from 'react'
import { useAccount } from '@/contexts/AccountContext'

export default function HistoryPanel() {
  const { ledgerId } = useAccount()
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
    fetch(`/api/history?ledger_id=${encodeURIComponent(ledgerId)}`)
      .then((r) => r.json())
      .then(setReceipts)
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadHistory() }, [ledgerId])

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim()) { setSearchResults(null); return }
    setSearching(true)
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, ledger_id: ledgerId }),
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
      const res = await fetch(`/api/history?id=${receipt.id}&ledger_id=${encodeURIComponent(ledgerId)}`, { method: 'DELETE' })
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
    <main className="flex flex-col relative w-full max-w-2xl mx-auto pt-32 pb-44 px-6">
      <div className="flex flex-col gap-2 mb-12">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/65">Past Receipts</span>
          <div className="flex-1 h-[0.5px] bg-on-surface/10" />
        </div>
        <h1 className="font-display-lg text-4xl text-on-surface shimmer-text">History</h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="flex-1 glass-shard rounded-full flex items-center px-4">
          <span className="material-symbols-outlined text-[18px] text-on-surface/55">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past items…"
            className="flex-1 bg-transparent px-3 py-3 text-sm focus:outline-none placeholder:text-on-surface/55"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !searchQuery.trim()}
          className="bg-on-surface text-white px-5 py-3 rounded-full font-mono text-[11px] uppercase tracking-widest disabled:opacity-40 transition"
        >
          {searching ? '…' : 'Search'}
        </button>
        {searchResults && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setSearchResults(null) }}
            className="px-4 py-3 rounded-full glass-shard font-mono text-[11px] uppercase tracking-widest text-on-surface/75 hover:text-on-surface transition"
          >
            Clear
          </button>
        )}
      </form>

      {/* Search results */}
      {searchResults && (
        <div className="flex flex-col gap-3 mb-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/65">Semantic matches</p>
          {searchResults.length === 0 ? (
            <div className="glass-shard rounded-3xl px-5 py-6 text-center">
              <p className="text-on-surface/65 text-sm">No matching items found.</p>
            </div>
          ) : (
            searchResults.map((r, i) => (
              <div key={i} className="glass-shard rounded-3xl flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-semibold text-on-surface text-sm">{r.item_name}</span>
                  <p className="font-mono text-[10px] text-on-surface/55 mt-0.5">
                    {r.receipt_code} · {new Date(r.purchased_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    {Math.round(r.similarity * 100)}%
                  </span>
                  <span className="font-mono font-bold text-on-surface">${parseFloat(r.price).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="font-mono text-xs text-red-500 mb-6 text-center">{error}</p>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-7 h-7 border-2 border-on-surface/15 border-t-on-surface rounded-full animate-spin" />
        </div>
      )}

      {!loading && receipts.length === 0 && !error && (
        <div className="border border-dashed border-on-surface/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-6">
          <div className="w-12 h-12 glass-shard rounded-full flex items-center justify-center opacity-30">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
          <p className="font-display-lg text-lg text-on-surface/55 text-center italic">
            No history yet.<br />Upload a receipt to get started.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
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
            <div key={receipt.id} className="broken-grid-item glass-shard rounded-3xl overflow-hidden transition-all">
              <div className="flex items-center gap-2 px-5 py-5">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                  className="flex-1 flex items-center gap-4 text-left min-w-0"
                >
                  <span className={`w-9 h-9 glass-shard rounded-full flex items-center justify-center text-on-surface text-xs font-black flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`}>
                    +
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display-lg text-lg text-on-surface truncate">
                      {receipt.store_name || receipt.receipt_code}
                    </p>
                    <p className="font-mono text-[10px] text-on-surface/65 mt-0.5">
                      {new Date(receipt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{receipt.paid_by}
                      {receipt.store_name && <span className="ml-1 text-on-surface/45">#{receipt.receipt_code}</span>}
                    </p>
                  </div>
                  <span className="font-mono font-black text-on-surface flex-shrink-0">${total.toFixed(2)}</span>
                </button>

                <button
                  onClick={() => handleDelete(receipt)}
                  disabled={isDeleting}
                  className="w-8 h-8 rounded-full glass-shard flex items-center justify-center text-on-surface/65 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition flex-shrink-0"
                  title="Delete receipt"
                >
                  <span className="material-symbols-outlined text-[16px]">{isDeleting ? 'hourglass_empty' : 'delete'}</span>
                </button>
              </div>

              {isExpanded && (
                <div className="mx-5 mb-5 border-t border-on-surface/10 pt-4">
                  <div className="flex flex-col divide-y divide-on-surface/5">
                    {receipt.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-on-surface/90 font-medium">{item.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-[10px] text-on-surface/55">{(item.split_with || []).join(', ')}</span>
                          <span className="font-mono font-bold text-on-surface w-14 text-right">
                            ${parseFloat(item.price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 flex flex-wrap items-center gap-2">
                    {Object.entries(personTotals).map(([person, amt]) => (
                      <span key={person} className="font-mono text-[10px] glass-shard px-2.5 py-1 rounded-full text-primary">
                        {person}: ${amt.toFixed(2)}
                      </span>
                    ))}
                  </div>
                  {receipt.notes && (
                    <p className="font-mono text-[10px] text-on-surface/55 pt-2">{receipt.notes}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
