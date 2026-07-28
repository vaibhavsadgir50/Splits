'use client'

import { useState } from 'react'
import Avatar from './Avatar'

export default function ItemSplitModal({ itemName, members, selected, onConfirm, onClose }) {
  const [localSelected, setLocalSelected] = useState(new Set(selected))

  function toggle(name) {
    const next = new Set(localSelected)
    next.has(name) ? next.delete(name) : next.add(name)
    setLocalSelected(next)
  }

  return (
    <div
      className="fixed inset-0 bg-on-surface/20 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="glass-shard rounded-3xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-on-surface/55">Split item</p>
            <h3 className="font-display-lg text-xl text-on-surface truncate max-w-[14rem]">{itemName || 'Untitled item'}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full glass-shard flex items-center justify-center text-on-surface/65 hover:text-on-surface transition flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Who's sharing this?</p>
          <button
            onClick={() => setLocalSelected(new Set(members))}
            className="font-mono text-[9px] uppercase tracking-widest text-primary hover:opacity-70 transition"
          >
            Select all
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {members.map((name) => {
            const isSelected = localSelected.has(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                className="flex flex-col items-center gap-1.5"
              >
                <Avatar name={name} size="lg" selected={isSelected} className={isSelected ? '' : 'opacity-40'} />
                <span className={`font-mono text-[9px] truncate max-w-[4rem] ${isSelected ? 'text-on-surface font-bold' : 'text-on-surface/55'}`}>
                  {name}
                </span>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => onConfirm([...localSelected])}
          className="w-full py-3.5 rounded-full bg-on-surface text-white font-mono text-[11px] uppercase tracking-widest transition"
        >
          Done · {localSelected.size} selected
        </button>
      </div>
    </div>
  )
}
