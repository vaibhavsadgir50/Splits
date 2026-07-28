'use client'

import { useState, useEffect } from 'react'
import { categoryIcon, categoryColor } from '@/lib/itemCategories'

export default function HomePage({ ledgers, userEmail, onEnterLedger, onAddLedger }) {
  const [stats, setStats] = useState({ today: 0, week: 0, year: 0, byCategory: [] })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!userEmail) { setStatsLoading(false); return }
    setStatsLoading(true)
    fetch(`/api/spending-stats?email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((d) => setStats({ today: d.today ?? 0, week: d.week ?? 0, year: d.year ?? 0, byCategory: d.byCategory ?? [] }))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [userEmail])

  const maxCategoryTotal = Math.max(1, ...stats.byCategory.map((c) => c.total))

  return (
    <main className="flex flex-col relative w-full max-w-lg mx-auto pt-32 pb-16 px-6">
      <div className="flex flex-col gap-2 mb-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/55">Your Spending</span>
        <h1 className="font-display-lg text-4xl text-on-surface shimmer-text">Trends</h1>
      </div>

      {/* Personal spending stats — across every account */}
      {!statsLoading && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Today', value: stats.today },
            { label: 'This Week', value: stats.week },
            { label: 'This Year', value: stats.year },
          ].map((s) => (
            <div key={s.label} className="glass-shard rounded-3xl px-2 py-4 flex flex-col items-center gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-widest text-on-surface/55 text-center">{s.label}</span>
              <span className="font-mono text-base font-black text-on-surface">${s.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Category breakdown */}
      {!statsLoading && stats.byCategory.length > 0 && (
        <div className="glass-shard rounded-3xl px-5 py-4 flex flex-col gap-3 mb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Where you're spending</p>
          <div className="flex flex-col gap-3">
            {stats.byCategory.map((c) => {
              const color = categoryColor(c.category)
              const pct = Math.max(6, (c.total / maxCategoryTotal) * 100)
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}22` }}>
                    <span className="material-symbols-outlined text-[14px]" style={{ color }}>{categoryIcon(c.category)}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-on-surface capitalize">{c.category.replace(/_/g, ' ')}</span>
                      <span className="font-mono font-bold text-on-surface">${c.total.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Inner Circle branding + accounts list */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/55">The Inner Circle</span>
          <div className="flex-1 h-[0.5px] bg-on-surface/10" />
        </div>
        <h2 className="font-display-lg text-2xl text-on-surface">Your Accounts</h2>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        {ledgers.map((l) => (
          <button
            key={l.ledger_id}
            onClick={() => onEnterLedger(l.ledger_id)}
            className="glass-shard rounded-3xl px-6 py-5 flex items-center justify-between text-left transition hover:scale-[1.02]"
          >
            <div className="flex flex-col">
              <span className="font-display-lg text-xl text-on-surface">{l.ledger_name}</span>
              <span className="font-mono text-[10px] text-on-surface/55 mt-0.5">as {l.member_name}</span>
            </div>
            <span className="material-symbols-outlined text-on-surface/30">chevron_right</span>
          </button>
        ))}
      </div>

      <button
        onClick={onAddLedger}
        className="glass-shard rounded-full px-6 py-4 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-widest text-on-surface/75 hover:text-on-surface transition"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
        Add Account
      </button>
    </main>
  )
}
