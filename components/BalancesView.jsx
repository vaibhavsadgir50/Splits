'use client'

import { useState, useEffect, useCallback } from 'react'
import Avatar from './Avatar'
import { useAccount } from '@/contexts/AccountContext'

export default function BalancesView() {
  const { ledgerId, ledgerName, setLedgerName, members } = useAccount()
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

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  const fetchBalances = useCallback(() => {
    setLoading(true)
    fetch(`/api/balances?ledger_id=${encodeURIComponent(ledgerId)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ledgerId])

  useEffect(() => { fetchBalances() }, [fetchBalances])

  async function handleSaveName() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === ledgerName) { setEditingName(false); return }
    setNameSaving(true)
    setNameError('')
    try {
      const res = await fetch(`/api/ledgers/${ledgerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledger_name: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setLedgerName(json.ledger_name)
    } catch (err) {
      setNameError(err.message || 'Failed to save name')
      setTimeout(() => setNameError(''), 4000)
    } finally {
      setNameSaving(false)
      setEditingName(false)
    }
  }

  function openMemberDetail(name) {
    setMemberDetail(name)
    setMemberItems([])
    setMemberItemsLoading(true)
    fetch(`/api/member-items?member=${encodeURIComponent(name)}&ledger_id=${encodeURIComponent(ledgerId)}`)
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
        body: JSON.stringify({ paid_by: settling.from, paid_to: settling.to, amount, note: settleNote, ledger_id: ledgerId }),
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
      <main className="flex flex-col relative w-full max-w-lg mx-auto pt-32 pb-44 px-6">
        <div className="flex flex-col gap-3 mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface shimmer-text">The Inner Circle</h1>

          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              maxLength={60}
              disabled={nameSaving}
              className="self-start font-display-lg text-xl italic text-primary bg-transparent border-b-2 border-primary focus:outline-none disabled:opacity-50"
            />
          ) : (
            <button
              onClick={() => { setNameInput(ledgerName); setEditingName(true) }}
              className="self-start flex items-center gap-1.5 group"
            >
              <span className="font-display-lg text-xl italic text-primary">{ledgerName}</span>
              <span className="material-symbols-outlined text-[14px] text-on-surface/25 group-hover:text-on-surface/60 transition">edit</span>
            </button>
          )}

          {nameError && (
            <p className="font-mono text-[10px] text-red-500">Couldn't save: {nameError}</p>
          )}

          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/55">Accounts</span>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-3 border-on-surface/15 border-t-on-surface rounded-full animate-spin" />
          </div>
        )}

        {!loading && members.length === 0 && (
          <div className="border border-dashed border-on-surface/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-6">
            <div className="w-12 h-12 glass-shard rounded-full flex items-center justify-center opacity-30">
              <span className="material-symbols-outlined text-2xl">house</span>
            </div>
            <p className="font-display-lg text-lg text-on-surface/55 text-center italic">
              Add household members<br />to get started.
            </p>
          </div>
        )}

        {!loading && members.length > 0 && (
          <div className="flex flex-col gap-10">
            {members.map((name) => {
              const bal = Math.round((netBalances[name] ?? 0) * 100) / 100
              const isOwed = bal > 0.005
              const owes = bal < -0.005
              const theyOwe = settlements.filter((s) => s.from === name)
              const owedToThem = settlements.filter((s) => s.to === name)
              const hasPairwise = theyOwe.length > 0 || owedToThem.length > 0

              const amountColor = isOwed ? 'text-emerald-600' : owes ? 'text-red-500' : 'text-on-surface/55'
              const statusLabel = isOwed ? 'Owed' : owes ? 'Owes' : 'Settled'

              return (
                <div key={name} className="broken-grid-item glass-shard rounded-3xl p-8 flex flex-col gap-6 transition-all duration-500 hover:scale-[1.02]">
                  <button
                    onClick={() => openMemberDetail(name)}
                    className="flex justify-between items-end text-left"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar name={name} size="lg" />
                      <div className="flex flex-col">
                        <span className="font-display-lg text-2xl mb-1">{name}</span>
                        <span className="font-mono text-[11px] text-on-surface/65">
                          {hasPairwise ? `${theyOwe.length + owedToThem.length} open item${theyOwe.length + owedToThem.length === 1 ? '' : 's'}` : 'All settled up'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className={`font-mono text-lg font-bold ${amountColor}`}>
                        {isOwed ? `+$${bal.toFixed(2)}` : owes ? `-$${Math.abs(bal).toFixed(2)}` : '$0.00'}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-on-surface/55">{statusLabel}</span>
                    </div>
                  </button>

                  {hasPairwise && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-on-surface/10">
                      {theyOwe.map((s, i) => (
                        <div key={`owe-${i}`} className="flex items-center gap-3 py-1">
                          <span className="font-mono text-xs text-on-surface/75 flex-1">
                            Owes <span className="font-bold text-on-surface">{s.to}</span>
                          </span>
                          <span className="font-mono text-xs font-bold text-red-500">${s.amount.toFixed(2)}</span>
                          <button
                            onClick={() => openSettle(s.from, s.to, s.amount)}
                            className="font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full glass-shard hover:scale-105 transition"
                          >
                            Settle
                          </button>
                        </div>
                      ))}
                      {owedToThem.map((s, i) => (
                        <div key={`owed-${i}`} className="flex items-center gap-3 py-1">
                          <span className="font-mono text-xs text-on-surface/75 flex-1">
                            <span className="font-bold text-on-surface">{s.from}</span> owes you
                          </span>
                          <span className="font-mono text-xs font-bold text-emerald-600">${s.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Settle modal */}
      {settling && (
        <div
          className="fixed inset-0 bg-on-surface/20 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSettling(null) }}
        >
          <form
            onSubmit={handleSettle}
            className="glass-shard rounded-3xl w-full max-w-sm p-7 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display-lg text-xl text-on-surface">Record Payment</h3>
              <button type="button" onClick={() => setSettling(null)} className="w-8 h-8 rounded-full glass-shard flex items-center justify-center text-on-surface/75 hover:text-on-surface transition">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="glass-shard rounded-3xl px-4 py-3 flex items-center gap-3">
              <Avatar name={settling.from} size="sm" />
              <div className="flex-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface/65">paying</p>
                <p className="font-display-lg text-on-surface">{settling.from} → {settling.to}</p>
              </div>
              <Avatar name={settling.to} size="sm" />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface/75">Amount</label>
              <div className="mt-2 glass-shard rounded-3xl flex items-center px-4">
                <span className="text-on-surface/65 font-mono">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="flex-1 py-3 pl-2 font-mono font-semibold bg-transparent focus:outline-none"
                  autoFocus
                />
              </div>
              <p className="font-mono text-[10px] text-on-surface/55 mt-1.5 px-1">Full amount: ${settling.amount.toFixed(2)}</p>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-on-surface/75">Note (optional)</label>
              <input
                type="text"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                placeholder="e.g. Venmo, cash"
                className="mt-2 w-full glass-shard rounded-3xl px-4 py-3 text-sm focus:outline-none placeholder:text-on-surface/55"
              />
            </div>

            {settleError && <p className="font-mono text-xs text-red-500">{settleError}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSettling(null)}
                className="flex-1 py-3 rounded-full glass-shard font-mono text-[11px] uppercase tracking-widest transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={settleLoading}
                className="flex-1 py-3 rounded-full bg-on-surface text-white font-mono text-[11px] uppercase tracking-widest disabled:opacity-50 transition"
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
          className="fixed inset-0 bg-on-surface/20 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setMemberDetail(null) }}
        >
          <div className="glass-shard rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-on-surface/10">
              <div className="flex items-center gap-3">
                <Avatar name={memberDetail} size="sm" />
                <h3 className="font-display-lg text-xl text-on-surface">{memberDetail}</h3>
              </div>
              <button onClick={() => setMemberDetail(null)} className="w-8 h-8 rounded-full glass-shard flex items-center justify-center text-on-surface/75 hover:text-on-surface transition">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {memberItemsLoading && (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-on-surface/15 border-t-on-surface rounded-full animate-spin" />
                </div>
              )}
              {!memberItemsLoading && memberItems.length === 0 && (
                <p className="font-mono text-xs text-on-surface/65 text-center py-8">No items found.</p>
              )}
              {memberItems.map((item, i) => {
                const share = parseFloat(item.per_person_amt) || 0
                const price = parseFloat(item.price) || 0
                const others = (item.split_with ?? []).filter((m) => m !== memberDetail)
                return (
                  <div key={i} className="bg-white/50 backdrop-blur-md border border-white/60 rounded-3xl px-4 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-on-surface text-sm">{item.name}</span>
                      <span className="font-mono text-sm font-bold text-on-surface whitespace-nowrap">${price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-on-surface/65">
                      <span>Split with: {others.length === 0 ? `only ${memberDetail}` : others.join(', ')}</span>
                      <span className="font-mono font-bold text-primary">${share.toFixed(2)} your share</span>
                    </div>
                    {item.receipt && (
                      <p className="font-mono text-[10px] text-on-surface/55">
                        Paid by <strong>{item.receipt.paid_by}</strong> · {item.receipt.receipt_code}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {!memberItemsLoading && memberItems.length > 0 && (
              <div className="border-t border-on-surface/10 px-6 py-4 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface/75">Total spent</span>
                <span className="font-mono text-xl font-black text-on-surface">
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
