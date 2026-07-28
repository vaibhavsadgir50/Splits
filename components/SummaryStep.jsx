'use client'

import Avatar from './Avatar'

export default function SummaryStep({ summary, receiptId, onReset }) {
  const paidBy = summary?.paid_by ?? ''
  const owedMap = summary?.summary ?? {}
  const entries = Object.entries(owedMap).sort((a, b) => b[1] - a[1])
  const totalOwed = entries.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="max-w-md mx-auto space-y-8 text-center">
      <div className="glass-shard rounded-3xl py-10 px-6 space-y-2">
        <p className="text-6xl">🎉</p>
        <h1 className="font-display-lg text-3xl text-on-surface">Saved!</h1>
        <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/65">
          {receiptId}{paidBy && ` · paid by ${paidBy}`}
        </p>
      </div>

      {entries.length > 0 ? (
        <div className="glass-shard rounded-3xl overflow-hidden text-left">
          <div className="px-5 py-4 border-b border-on-surface/10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/75">
              Amounts owed to <span className="text-primary">{paidBy}</span>
            </p>
          </div>
          <div className="divide-y divide-on-surface/5">
            {entries.map(([name, amount]) => (
              <div key={name} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <span className="font-semibold text-on-surface">{name}</span>
                </div>
                <span className="font-mono font-black text-on-surface text-lg">${amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-on-surface/10 bg-on-surface/[0.02] flex justify-between items-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface/75">Total to collect</span>
            <span className="font-mono font-black text-primary text-lg">${totalOwed.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className="glass-shard rounded-3xl px-6 py-5">
          <p className="text-on-surface/80 font-medium">{paidBy} covered everything — no one owes anything.</p>
        </div>
      )}

      <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface/55">Balances on the home screen have been updated.</p>

      <button
        onClick={onReset}
        className="w-full bg-on-surface text-white py-4 rounded-full font-mono text-sm uppercase tracking-widest transition"
      >
        Done
      </button>
    </div>
  )
}
