'use client'

import { useState } from 'react'

export default function ReviewStep({
  members, paidBy, receiptId, storeName,
  items, onItemsChange,
  assignments, onAssignmentsChange,
  onSubmitted, onBack, onDiscard,
}) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleAssignment(itemIdx, memberName) {
    const next = { ...assignments }
    const set = new Set(next[itemIdx] ?? [])
    set.has(memberName) ? set.delete(memberName) : set.add(memberName)
    next[itemIdx] = set
    onAssignmentsChange(next)
  }

  function toggleAllForMember(memberName) {
    const allChecked = items.every((_, i) => (assignments[i] ?? new Set()).has(memberName))
    const next = { ...assignments }
    items.forEach((_, i) => {
      const set = new Set(next[i] ?? [])
      allChecked ? set.delete(memberName) : set.add(memberName)
      next[i] = set
    })
    onAssignmentsChange(next)
  }

  function toggleAllForItem(itemIdx) {
    const allChecked = members.every((m) => (assignments[itemIdx] ?? new Set()).has(m))
    const next = { ...assignments, [itemIdx]: allChecked ? new Set() : new Set(members) }
    onAssignmentsChange(next)
  }

  function updateItem(idx, field, value) {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: field === 'price' ? parseFloat(value) || 0 : value }
    onItemsChange(next)
  }

  function addItem() {
    const idx = items.length
    onItemsChange([...items, { name: '', price: 0 }])
    onAssignmentsChange({ ...assignments, [idx]: new Set(members) })
  }

  function removeItem(idx) {
    const next = items.filter((_, i) => i !== idx)
    const nextA = {}
    next.forEach((_, i) => { nextA[i] = assignments[i < idx ? i : i + 1] ?? new Set() })
    onItemsChange(next)
    onAssignmentsChange(nextA)
  }

  const totals = Object.fromEntries(members.map((m) => [m, 0]))
  items.forEach((item, idx) => {
    const split = [...(assignments[idx] ?? new Set())]
    if (split.length) {
      const share = item.price / split.length
      split.forEach((m) => { totals[m] = (totals[m] ?? 0) + share })
    }
  })

  async function handleSubmit() {
    const payload = {
      receipt_id: receiptId,
      paid_by: paidBy,
      store_name: storeName,
      notes,
      items: items
        .map((item, idx) => ({
          name: item.name,
          price: item.price,
          split_with: [...(assignments[idx] ?? new Set())],
        }))
        .filter((i) => i.name && i.split_with.length > 0),
    }
    if (!payload.items.length) {
      setError('No items assigned. Tick at least one person per item.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSubmitted(data)
    } catch (err) {
      setError(err.message || 'Failed to save. Check your Supabase connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">
            {storeName || 'Review & Split'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {storeName && <span className="mr-1">Receipt & split ·</span>}
            <span className="font-mono font-semibold text-brand-600">{receiptId}</span>
            {' · '}paid by <strong>{paidBy}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDiscard}
            className="text-sm text-rose-500 hover:text-rose-700 px-3 py-2 rounded-2xl clay-sm bg-rose-50 font-semibold transition"
          >
            Discard
          </button>
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-2xl clay-sm bg-gray-100 font-semibold transition"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="clay bg-white/90 rounded-3xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-100">
              <th className="text-left px-5 py-4 font-bold text-gray-700 min-w-44">Item</th>
              <th className="text-right px-3 py-4 font-bold text-gray-700 w-24">Price</th>
              <th className="text-center px-2 py-4 font-bold text-gray-400 w-10 text-xs">All</th>
              {members.map((m) => (
                <th key={m} className="text-center px-3 py-4 min-w-[5rem]">
                  <button
                    onClick={() => toggleAllForMember(m)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition clay-sm ${
                      items.every((_, i) => (assignments[i] ?? new Set()).has(m))
                        ? 'bg-brand-600 text-white'
                        : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                    }`}
                  >
                    {m}
                  </button>
                </th>
              ))}
              <th className="w-8 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item, idx) => {
              const split = [...(assignments[idx] ?? new Set())]
              const perPerson = split.length > 1 ? item.price / split.length : null
              return (
                <tr key={idx} className="hover:bg-brand-50/30 transition">
                  <td className="px-5 py-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      className="w-full bg-transparent border-b-2 border-transparent focus:border-brand-400 focus:outline-none py-0.5 font-medium"
                      placeholder="Item name"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <span className="text-gray-400 text-xs font-semibold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => updateItem(idx, 'price', e.target.value)}
                        className="w-16 text-right bg-transparent border-b-2 border-transparent focus:border-brand-400 focus:outline-none py-0.5 font-semibold"
                      />
                    </div>
                    {perPerson && (
                      <p className="text-right text-xs text-gray-400 mt-0.5">${perPerson.toFixed(2)} ea.</p>
                    )}
                  </td>
                  <td className="text-center px-2 py-3">
                    <input
                      type="checkbox"
                      checked={members.length > 0 && members.every((m) => (assignments[idx] ?? new Set()).has(m))}
                      onChange={() => toggleAllForItem(idx)}
                      className="w-4 h-4 accent-brand-600 cursor-pointer"
                    />
                  </td>
                  {members.map((m) => (
                    <td key={m} className="text-center px-3 py-3">
                      <input
                        type="checkbox"
                        checked={(assignments[idx] ?? new Set()).has(m)}
                        onChange={() => toggleAssignment(idx, m)}
                        className="w-4 h-4 accent-brand-600 cursor-pointer"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-3">
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-gray-300 hover:text-rose-500 transition text-lg leading-none"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-brand-100 bg-brand-50/40">
              <td className="px-5 py-3">
                <button onClick={addItem} className="text-brand-600 hover:text-brand-700 text-xs font-bold">
                  + Add item
                </button>
              </td>
              <td className="px-3 py-3 text-right font-black text-gray-900">
                ${items.reduce((s, i) => s + (i.price || 0), 0).toFixed(2)}
              </td>
              <td />
              {members.map((m) => (
                <td key={m} className="text-center px-3 py-3">
                  <span className="text-xs font-black text-brand-700">${totals[m].toFixed(2)}</span>
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      <div>
        <label className="text-sm font-bold text-gray-700">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Weekly shop at Trader Joe's"
          className="mt-2 w-full clay-inset bg-white/80 rounded-2xl px-4 py-3 text-sm focus:outline-none"
        />
      </div>

      {error && (
        <div className="clay-inset bg-red-50 rounded-2xl px-4 py-3">
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-gradient-to-r from-brand-600 to-brand-500 text-white py-4 rounded-3xl font-black text-base clay-btn disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Saving…
          </>
        ) : (
          'Calculate & Save'
        )}
      </button>
    </div>
  )
}
