'use client'

import { useState } from 'react'
import FloatingCTA from './FloatingCTA'
import { cartoonAvatarUrl } from '@/lib/avatars'
import { useAvatars } from '@/contexts/AvatarContext'

const AVATAR_SHAPES = ['circle', 'diamond', 'oval']

function MemberAvatar({ name, shape }) {
  const { avatarMap } = useAvatars()
  const src = avatarMap[name] || cartoonAvatarUrl(name)
  const style = { backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }

  if (shape === 'diamond') {
    return <div className="w-16 h-16 rounded-none ring-2 ring-white transform rotate-45 flex-shrink-0" style={style} />
  }
  if (shape === 'oval') {
    return <div className="w-20 h-14 rounded-full ring-2 ring-white flex-shrink-0" style={style} />
  }
  return <div className="w-16 h-16 rounded-full ring-2 ring-white flex-shrink-0" style={style} />
}

export default function MembersPanel({ members, onChanged, ledgerId }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [removingName, setRemovingName] = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/members?name=${encodeURIComponent(name)}&ledger_id=${encodeURIComponent(ledgerId)}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewName('')
      setAdding(false)
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(name) {
    if (!confirm(`Remove ${name} from the household?`)) return
    setRemovingName(name)
    setTimeout(async () => {
      try {
        await fetch(`/api/members/${encodeURIComponent(name)}?ledger_id=${encodeURIComponent(ledgerId)}`, { method: 'DELETE' })
        await onChanged()
      } catch {
        setError('Failed to remove member')
      } finally {
        setRemovingName(null)
      }
    }, 400)
  }

  return (
    <>
      <main className="flex flex-col relative w-full max-w-lg mx-auto pt-32 pb-44 px-6">
        <div className="flex flex-col gap-2 mb-12">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/65">Household Management</span>
            <div className="flex-1 h-[0.5px] bg-on-surface/10" />
          </div>
          <h1 className="font-display-lg text-4xl text-on-surface shimmer-text">Household Members</h1>
        </div>

        <div className="flex flex-col gap-10">
          {members.map((name, i) => (
            <div
              key={name}
              className="broken-grid-item glass-shard rounded-3xl p-8 flex flex-col gap-6 transition-all duration-500 hover:scale-[1.02]"
              style={removingName === name ? { transform: 'translateY(40px) scale(0.9) rotate(5deg)', opacity: 0, filter: 'blur(10px)' } : undefined}
            >
              <div className="flex justify-between items-start">
                <MemberAvatar name={name} shape={AVATAR_SHAPES[i % AVATAR_SHAPES.length]} />
                <button
                  onClick={() => handleRemove(name)}
                  className="w-8 h-8 flex items-center justify-center glass-shard rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <div className="flex flex-col">
                <span className="font-display-lg text-2xl mb-1">{name}</span>
                <span className="font-mono text-[11px] text-on-surface/65">Household member</span>
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <div className="border border-dashed border-on-surface/10 rounded-3xl p-12 flex flex-col items-center justify-center gap-6">
              <div className="w-12 h-12 glass-shard rounded-full flex items-center justify-center opacity-30">
                <span className="material-symbols-outlined text-2xl">person_add</span>
              </div>
              <p className="font-display-lg text-lg text-on-surface/55 text-center italic">
                Expand your circle and share<br />the load with friends.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="font-mono text-xs text-red-500 mt-6 text-center">{error}</p>
        )}
      </main>

      {adding ? (
        <div className="fixed bottom-28 left-0 right-0 px-6 flex justify-center z-40">
          <form onSubmit={handleAdd} className="glass-shard rounded-3xl px-6 py-4 flex items-center gap-3 w-full max-w-sm">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Member name"
              className="flex-1 bg-transparent focus:outline-none font-mono text-sm placeholder:text-on-surface/55"
            />
            <button
              type="button"
              onClick={() => { setAdding(false); setNewName('') }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-on-surface/5 transition"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface/65">close</span>
            </button>
            <button
              type="submit"
              disabled={loading || !newName.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-on-surface text-white disabled:opacity-40 transition"
            >
              <span className="material-symbols-outlined text-[18px]">{loading ? 'hourglass_empty' : 'check'}</span>
            </button>
          </form>
        </div>
      ) : (
        <FloatingCTA icon="add" label="Add New Member" onClick={() => setAdding(true)} />
      )}
    </>
  )
}
