'use client'

export default function SummaryStep({ summary, receiptId, onReset }) {
  const paidBy = summary?.paid_by ?? ''
  const owedMap = summary?.summary ?? {}
  const entries = Object.entries(owedMap).sort((a, b) => b[1] - a[1])
  const totalOwed = entries.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="max-w-md mx-auto space-y-6 text-center">
      <div className="clay bg-gradient-to-br from-emerald-50 to-green-100 rounded-4xl py-10 px-6 space-y-2">
        <p className="text-6xl">🎉</p>
        <h2 className="text-3xl font-black text-gray-900">Saved!</h2>
        <p className="text-gray-500 text-sm">
          Receipt <span className="font-mono font-bold text-brand-600">{receiptId}</span>
          {paidBy && <> · paid by <strong>{paidBy}</strong></>}
        </p>
      </div>

      {entries.length > 0 ? (
        <div className="clay bg-white/90 rounded-3xl overflow-hidden text-left">
          <div className="px-5 py-4 border-b border-brand-50">
            <p className="text-sm font-bold text-gray-700">
              Amounts owed to <span className="text-brand-600">{paidBy}</span>
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {entries.map(([name, amount]) => (
              <div key={name} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-400 to-red-500 clay-sm flex items-center justify-center text-white text-sm font-black">
                    {name[0].toUpperCase()}
                  </span>
                  <span className="font-semibold text-gray-900">{name}</span>
                </div>
                <span className="font-black text-gray-900 text-lg">${amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-brand-100 bg-brand-50/40 flex justify-between items-center">
            <span className="font-bold text-gray-600">Total to collect</span>
            <span className="font-black text-brand-700 text-lg">${totalOwed.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className="clay bg-white/80 rounded-3xl px-6 py-5">
          <p className="text-gray-500 font-medium">{paidBy} covered everything — no one owes anything.</p>
        </div>
      )}

      <p className="text-xs text-gray-400">Balances on the home screen have been updated.</p>

      <button
        onClick={onReset}
        className="w-full bg-gradient-to-r from-brand-600 to-brand-500 text-white py-4 rounded-3xl font-black clay-btn transition"
      >
        Done
      </button>
    </div>
  )
}
