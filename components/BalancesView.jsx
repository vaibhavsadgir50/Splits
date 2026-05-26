'use client'

import { useState, useEffect, useCallback } from 'react'

export default function BalancesView({ members, onUpload, refreshKey }) {
  const [data, setData] = useState({ settlements: [], netBalances: {} })
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [settleNote, setSettleNote] = useState('')
  const [settleLoading, setSettleLoading] = useState(false)
  const [settleError, setSettleError] = useState('')
  const [memberDetail, setMemberDetail] = useState(null)
  const [memberItems, setMemberItems] = useState([])
  const [memberItemsLoading, setMemberItemsLoading] = useState(false)

  const fetchBalances = useCallback(() => {
    setLoading(true)
    fetch('/api/balances')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchBalances() }, [fetchBalances, refreshKey])

  function openMemberDetail(name) {
    setMemberDetail(name)
    setMemberItems([])
    setMemberItemsLoading(true)
    fetch(`/api/member-items?member=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => setMemberItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setMemberItemsLoading(false))
  }

  function openSettle(from, to, amount) {
    setSettling({ from, to, amount })
    setSettleAmount(amount.toFixed(2))
    setSettleNote('')
    setSettleError('')
  }

  async function handleSettle(e) {
    e.preventDefault()
    const amount = parseFloat(settleAmount)
    if (!amount || amount <= 0) { setSettleError('Enter a valid amount'); return }
    setSettleLoading(true)
    setSettleError('')
    try {
      const res = await fetch('/api/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_by: settling.from, paid_to: settling.to, amount, note: settleNote }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSettling(null)
      fetchBalances()
    } catch (err) {
      setSettleError(err.message || 'Failed to record settlement')
    } finally {
      setSettleLoading(false)
    }
  }

  const { settlements, netBalances } = data

  return (
    <>
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-2xl font-black text-brand-800 tracking-tight">Accounts</h2>
          <button
            onClick={onUpload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-sm clay-btn transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Receipt
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-3 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && members.length === 0 && (
          <div className="clay bg-white/80 rounded-3xl px-6 py-10 text-center">
            <p className="text-4xl mb-3">🏠</p>
            <p className="text-gray-500 font-medium">Add household members to get started.</p>
          </div>
        )}

        {!loading && members.length > 0 && (
          <div className="space-y-4">
            {members.map((name) => {
              const bal = Math.round((netBalances[name] ?? 0) * 100) / 100
              const isOwed = bal > 0.005
              const owes = bal < -0.005
              const theyOwe = settlements.filter((s) => s.from === name)
              const owedToThem = settlements.filter((s) => s.to === name)
              const hasPairwise = theyOwe.length > 0 || owedToThem.length > 0

              const cardBg = isOwed
                ? 'bg-gradient-to-br from-emerald-50 to-green-100'
                : owes
                ? 'bg-gradient-to-br from-rose-50 to-red-100'
                : 'bg-gradient-to-br from-white to-brand-50'

              const avatarStyle = isOwed
                ? 'from-emerald-400 to-green-500'
                : owes
                ? 'from-rose-400 to-red-500'
                : 'from-brand-400 to-brand-600'

              const balColor = isOwed ? 'text-emerald-600' : owes ? 'text-rose-500' : 'text-gray-400'

              return (
                <div key={name} className={`clay rounded-3xl overflow-hidden ${cardBg}`}>
                  <button
                    onClick={() => openMemberDetail(name)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left active:opacity-80 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${avatarStyle} clay-sm flex items-center justify-center text-white text-base font-black flex-shrink-0`}>
                        {name[0].toUpperCase()}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {isOwed ? 'is owed' : owes ? 'owes' : 'all settled'}
                        </p>
                      </div>
                    </div>
                    <p className={`text-2xl font-black ${balColor}`}>
                      {isOwed ? `+$${bal.toFixed(2)}` : owes ? `-$${Math.abs(bal).toFixed(2)}` : '$0.00'}
                    </p>
                  </button>

                  {hasPairwise && (
                    <div className="mx-4 mb-4 clay-inset bg-white/50 rounded-2xl divide-y divide-white/60">
                      {theyOwe.map((s, i) => (
                        <div key={`owe-${i}`} className="flex items-center gap-3 px-4 py-3">
                          <span className="text-sm text-gray-600 flex-1">
                            Owes <span className="font-semibold text-gray-800">{s.to}</span>
                          </span>
                          <span className="text-sm font-bold text-rose-500">${s.amount.toFixed(2)}</span>
                          <button
                            onClick={() => openSettle(s.from, s.to, s.amount)}
                            className="text-xs px-3 py-1.5 rounded-xl bg-brand-600 text-white font-semibold clay-btn transition"
                          >
                            Settle
                          </button>
                        </div>
                      ))}
                      {owedToThem.map((s, i) => (
                        <div key={`owed-${i}`} className="flex items-center gap-3 px-4 py-3">
                          <span className="text-sm text-gray-600 flex-1">
                            <span className="font-semibold text-gray-800">{s.from}</span> owes you
                          </span>
                          <span className="text-sm font-bold text-emerald-600">${s.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}


      </div>

      {/* Settle modal */}
      {settling && (
        <div
          className="fixed inset-0 bg-brand-900/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSettling(null) }}
        >
          <form
            onSubmit={handleSettle}
            className="bg-white/95 clay rounded-4xl w-full max-w-sm p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Record Payment</h3>
              <button type="button" onClick={() => setSettling(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="clay-inset bg-brand-50 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white text-sm font-black">
                {settling.from[0].toUpperCase()}
              </span>
              <div className="flex-1">
                <p className="text-xs text-gray-400">paying</p>
                <p className="font-bold text-gray-900">{settling.from} → {settling.to}</p>
              </div>
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white text-sm font-black">
                {settling.to[0].toUpperCase()}
              </span>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700">Amount</label>
              <div className="mt-2 clay-inset bg-gray-50 rounded-2xl flex items-center px-4">
                <span className="text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="flex-1 py-3 pl-2 text-sm font-semibold bg-transparent focus:outline-none"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5 px-1">Full amount: ${settling.amount.toFixed(2)}</p>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700">Note <span className="font-normal text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                placeholder="e.g. Venmo, cash"
                className="mt-2 w-full clay-inset bg-gray-50 rounded-2xl px-4 py-3 text-sm focus:outline-none"
              />
            </div>

            {settleError && <p className="text-rose-500 text-sm font-medium">{settleError}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSettling(null)}
                className="flex-1 py-3 rounded-2xl clay-sm bg-gray-100 text-sm font-bold text-gray-600 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={settleLoading}
                className="flex-1 py-3 rounded-2xl bg-brand-600 text-white text-sm font-black clay-btn disabled:opacity-50 transition"
              >
                {settleLoading ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Member detail modal */}
      {memberDetail && (
        <div
          className="fixed inset-0 bg-brand-900/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setMemberDetail(null) }}
        >
          <div className="bg-white/95 clay rounded-4xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 clay-sm flex items-center justify-center text-white font-black">
                  {memberDetail[0].toUpperCase()}
                </span>
                <h3 className="text-lg font-black text-gray-900">{memberDetail}</h3>
              </div>
              <button onClick={() => setMemberDetail(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {memberItemsLoading && (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!memberItemsLoading && memberItems.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">No items found.</p>
              )}
              {memberItems.map((item, i) => {
                const share = parseFloat(item.per_person_amt) || 0
                const price = parseFloat(item.price) || 0
                const others = (item.split_with ?? []).filter((m) => m !== memberDetail)
                return (
                  <div key={i} className="clay-sm bg-brand-50/60 rounded-2xl px-4 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{item.name}</span>
                      <span className="text-sm font-bold text-gray-700 whitespace-nowrap">${price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Split with: {others.length === 0 ? `only ${memberDetail}` : others.join(', ')}</span>
                      <span className="font-bold text-brand-600">${share.toFixed(2)} your share</span>
                    </div>
                    {item.receipt && (
                      <p className="text-xs text-gray-400">
                        Paid by <strong>{item.receipt.paid_by}</strong> · {item.receipt.receipt_code}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {!memberItemsLoading && memberItems.length > 0 && (
              <div className="border-t border-brand-100 px-6 py-4 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-600">Total spent</span>
                <span className="text-xl font-black text-gray-900">
                  ${memberItems.reduce((s, i) => s + (parseFloat(i.per_person_amt) || 0), 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
