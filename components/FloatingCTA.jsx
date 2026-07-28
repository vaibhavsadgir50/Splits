export default function FloatingCTA({ icon, label, onClick, disabled }) {
  return (
    <div className="fixed bottom-28 left-0 right-0 px-6 flex justify-center z-40">
      <button
        onClick={onClick}
        disabled={disabled}
        className="group glass-shard rounded-3xl px-12 py-5 text-on-surface flex items-center gap-4 hover:scale-[1.05] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <span className="material-symbols-outlined font-light text-2xl">{icon}</span>
        <span className="font-mono text-[12px] uppercase tracking-[0.3em] font-bold">{label}</span>
      </button>
    </div>
  )
}
