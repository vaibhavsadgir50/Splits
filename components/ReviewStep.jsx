'use client'

import { useState, useEffect } from 'react'
import AvatarStack from './AvatarStack'
import Avatar from './Avatar'
import ItemSplitModal from './ItemSplitModal'
import { categoryIcon, categoryColor } from '@/lib/itemCategories'

// Standard non-veg indicator (brown/maroon square outline, solid dot inside)
// — shown instead of an actual photo for meat/seafood items, same convention
// as the mark printed on Indian packaged food.
function NonVegSymbol() {
  return (
    <span className="w-6 h-6 border-2 border-red-800 flex items-center justify-center flex-shrink-0" title="Non-vegetarian">
      <span className="w-2.5 h-2.5 rounded-full bg-red-800" />
    </span>
  )
}

function ItemThumbnail({ item, onView, onImageResolved }) {
  const [errored, setErrored] = useState(false)
  const isMeat = item.category === 'meat_seafood'
  const [status, setStatus] = useState(item.image_url || isMeat ? 'done' : 'loading') // 'loading' | 'done'
  const color = categoryColor(item.category)
  const hasImage = item.image_url && !errored && !isMeat

  // Images are resolved lazily, client-side, one request per item, so a
  // slow/flaky free image source never blocks the receipt from parsing —
  // this thumbnail just fills in whenever its own lookup finishes.
  // Meat/seafood items never fetch or show a photo — the non-veg symbol
  // is shown instead, always, by design.
  useEffect(() => {
    if (isMeat || item.image_url || !item.name) { setStatus('done'); return }
    let cancelled = false
    const params = new URLSearchParams({ name: item.name, raw_name: item.raw_name || item.name })
    fetch(`/api/item-image?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.image_url) onImageResolved(d.image_url) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStatus('done') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.name, isMeat])

  const loadingImage = status === 'loading' && !hasImage

  return (
    <button
      type="button"
      onClick={hasImage ? onView : undefined}
      className={`w-20 h-16 rounded-2xl overflow-hidden flex-shrink-0 ring-1 ring-on-surface/10 bg-white flex items-center justify-center ${hasImage ? 'active:scale-95 transition' : 'cursor-default'}`}
    >
      {isMeat ? (
        <NonVegSymbol />
      ) : hasImage ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : loadingImage ? (
        <span className="w-full h-full animate-pulse bg-on-surface/10" />
      ) : (
        <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
          <span className="material-symbols-outlined text-[18px]" style={{ color }}>
            {categoryIcon(item.category)}
          </span>
        </span>
      )}
    </button>
  )
}

export default function ReviewStep({
  members, paidBy, receiptId, storeName,
  items, onItemsChange,
  assignments, onAssignmentsChange,
  onSubmitted, onBack, onDiscard,
  ledgerId,
}) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [splitModalIdx, setSplitModalIdx] = useState(null)
  const [swapFromIdx, setSwapFromIdx] = useState(null)
  const [lightboxItem, setLightboxItem] = useState(null)

  function updateItem(idx, field, value) {
    const next = [...items]
    next[idx] = { ...next[idx], [field]: field === 'price' ? parseFloat(value) || 0 : value }
    onItemsChange(next)
  }

  function handleImageResolved(idx, url) {
    // Every item's image resolves concurrently (one fetch per thumbnail,
    // fired in parallel on mount) — building `next` from the `items`
    // closure here would race: whichever resolves last overwrites the
    // whole array from a stale snapshot, wiping out every image that
    // resolved in between. The functional update form always applies
    // against the true latest state instead.
    onItemsChange((prevItems) => {
      const next = [...prevItems]
      next[idx] = { ...next[idx], image_url: url }
      return next
    })
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

  function setItemSplit(idx, names) {
    onAssignmentsChange({ ...assignments, [idx]: new Set(names) })
  }

  function handleSwapTap(idx) {
    if (swapFromIdx === null) {
      setSwapFromIdx(idx)
      return
    }
    if (swapFromIdx === idx) {
      setSwapFromIdx(null)
      return
    }
    const next = [...items]
    const priceA = next[swapFromIdx].price
    next[swapFromIdx] = { ...next[swapFromIdx], price: next[idx].price, confidence: 'high' }
    next[idx] = { ...next[idx], price: priceA, confidence: 'high' }
    onItemsChange(next)
    setSwapFromIdx(null)
  }

  function isMemberInBill(name) {
    return items.some((_, idx) => (assignments[idx] ?? new Set()).has(name))
  }

  function toggleMemberAcrossBill(name) {
    const inBill = isMemberInBill(name)
    const next = {}
    items.forEach((_, idx) => {
      const set = new Set(assignments[idx] ?? new Set())
      inBill ? set.delete(name) : set.add(name)
      next[idx] = set
    })
    onAssignmentsChange(next)
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
      ledger_id: ledgerId,
      items: items
        .map((item, idx) => ({
          name: item.name,
          price: item.price,
          category: item.category || null,
          split_with: [...(assignments[idx] ?? new Set())],
        }))
        .filter((i) => i.name && i.split_with.length > 0),
    }
    if (!payload.items.length) {
      setError('No items assigned. Tap each item and pick at least one person.')
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

  const memberTotals = members.filter((m) => totals[m] > 0.005)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display-lg text-3xl text-on-surface">
            {storeName || 'Review & Split'}
          </h1>
          <p className="font-mono text-[10px] text-on-surface/65 mt-2 uppercase tracking-widest">
            {receiptId} · paid by {paidBy}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDiscard}
            className="glass-shard rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50 transition"
          >
            Discard
          </button>
          <button
            onClick={onBack}
            className="glass-shard rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-on-surface/80 hover:text-on-surface transition"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Bulk remove/add a member across the whole bill */}
      <div className="glass-shard rounded-full pl-4 pr-3 py-2.5 flex items-center gap-3">
        <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface/55 flex-shrink-0">Splitting with</span>
        <div className="flex items-center gap-2 overflow-x-auto">
          {members.map((m) => {
            const inBill = isMemberInBill(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMemberAcrossBill(m)}
                title={inBill ? `Remove ${m} from the entire bill` : `Add ${m} back to the entire bill`}
                className="flex-shrink-0"
              >
                <Avatar name={m} size="xs" className={inBill ? '' : 'opacity-30 grayscale'} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Items */}
      {swapFromIdx !== null && (
        <div className="flex items-center justify-between glass-shard rounded-full px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface/75">
            Tap another item's price to swap
          </span>
          <button
            onClick={() => setSwapFromIdx(null)}
            className="font-mono text-[10px] uppercase tracking-widest text-primary"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="glass-shard rounded-3xl overflow-hidden divide-y divide-on-surface/10">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Item</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Price</span>
        </div>

        {items.map((item, idx) => {
          const split = [...(assignments[idx] ?? new Set())]
          const perPerson = split.length > 1 ? item.price / split.length : null
          const uncertain = item.confidence === 'low'
          const isSwapSource = swapFromIdx === idx
          return (
            <div key={idx} className={`px-5 py-4 flex gap-4 transition-colors ${isSwapSource ? 'bg-primary/10' : ''}`}>
              <ItemThumbnail item={item} onView={() => setLightboxItem(item)} onImageResolved={(url) => handleImageResolved(idx, url)} />

              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {uncertain && (
                    <span
                      className="material-symbols-outlined text-amber-500 text-[16px] flex-shrink-0"
                      title="AI wasn't fully sure about this item — please verify"
                    >
                      warning
                    </span>
                  )}
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    className="flex-1 min-w-0 bg-transparent border-b-2 border-transparent focus:border-primary focus:outline-none py-0.5 font-medium placeholder:text-on-surface/45"
                    placeholder="Item name"
                  />
                  <button
                    onClick={() => handleSwapTap(idx)}
                    title="Swap price with another item"
                    className={`w-6 h-6 flex items-center justify-center rounded-full transition flex-shrink-0 ${
                      isSwapSource ? 'bg-primary text-white' : 'text-on-surface/35 hover:text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">swap_vert</span>
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-on-surface/40 hover:text-red-500 transition text-lg leading-none flex-shrink-0"
                  >
                    ×
                  </button>
                </div>

                <div className="flex items-center gap-0.5 self-start">
                  <span className="text-on-surface/45 text-xs font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.price}
                    onChange={(e) => updateItem(idx, 'price', e.target.value)}
                    className="w-16 bg-transparent border-b-2 border-transparent focus:border-primary focus:outline-none py-0.5 font-mono font-semibold"
                  />
                </div>

                <button
                  onClick={() => setSplitModalIdx(idx)}
                  className="flex items-center gap-3 self-end"
                >
                  {split.length > 0 ? (
                    <>
                      <span className="font-mono text-[9px] text-on-surface/65 text-right">
                        {split.length === 1 ? split[0] : `${split.length} people`}
                        {perPerson && ` · $${perPerson.toFixed(2)} ea.`}
                      </span>
                      <AvatarStack names={split} size="xs" max={5} />
                    </>
                  ) : (
                    <span className="font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-dashed border-on-surface/30 text-on-surface/65">
                      + Add people
                    </span>
                  )}
                </button>
              </div>
            </div>
          )
        })}

        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={addItem} className="font-mono text-[10px] uppercase tracking-widest text-primary hover:opacity-70">
            + Add item
          </button>
          <span className="font-mono font-black text-on-surface">
            ${items.reduce((s, i) => s + (i.price || 0), 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Split summary */}
      {memberTotals.length > 0 && (
        <div className="glass-shard rounded-3xl px-5 py-4 flex flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Split summary</p>
          <div className="flex flex-col gap-3">
            {memberTotals.map((m) => (
              <div key={m} className="flex items-center gap-3">
                <Avatar name={m} size="xs" />
                <span className="flex-1 text-sm font-semibold text-on-surface">{m}</span>
                <span className="font-mono text-sm font-bold text-primary">${totals[m].toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {splitModalIdx !== null && (
        <ItemSplitModal
          itemName={items[splitModalIdx]?.name}
          members={members}
          selected={[...(assignments[splitModalIdx] ?? new Set())]}
          onConfirm={(names) => { setItemSplit(splitModalIdx, names); setSplitModalIdx(null) }}
          onClose={() => setSplitModalIdx(null)}
        />
      )}

      {/* Full-size item image lightbox */}
      {lightboxItem && (
        <div
          className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center z-[70] p-6"
          onClick={() => setLightboxItem(null)}
        >
          <div className="glass-shard rounded-3xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="w-full aspect-square rounded-2xl bg-white overflow-hidden flex items-center justify-center">
              <img src={lightboxItem.image_url} alt={lightboxItem.name} className="w-full h-full object-contain" />
            </div>
            <p className="mt-4 text-center font-display-lg text-lg text-on-surface">{lightboxItem.name}</p>
            <button
              onClick={() => setLightboxItem(null)}
              className="mt-4 w-full py-3 rounded-full bg-on-surface text-white font-mono text-[11px] uppercase tracking-widest transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Weekly shop at Trader Joe's"
          className="mt-2 w-full glass-shard rounded-3xl px-4 py-3 text-sm focus:outline-none placeholder:text-on-surface/45"
        />
      </div>

      {error && (
        <p className="font-mono text-xs text-red-500">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-on-surface text-white py-4 rounded-full font-mono text-sm uppercase tracking-widest disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
