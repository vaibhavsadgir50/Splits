'use client'

import { useState, useRef } from 'react'
import Avatar from './Avatar'
import { useAvatars } from '@/contexts/AvatarContext'

function compressAvatarImage(file, maxDim = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      const canvas = document.createElement('canvas')
      canvas.width = maxDim
      canvas.height = maxDim
      canvas.getContext('2d').drawImage(img, sx, sy, size, size, 0, 0, maxDim, maxDim)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

export default function ProfileModal({ memberName, onClose, onSignOut }) {
  const { avatarMap, refreshAvatars } = useAvatars()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const hasCustomAvatar = Boolean(avatarMap[memberName])

  async function handleFile(file) {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const dataUrl = await compressAvatarImage(file)
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      refreshAvatars()
    } catch (err) {
      setError(err.message || 'Failed to upload photo')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      refreshAvatars()
    } catch {
      setError('Failed to remove photo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-on-surface/20 backdrop-blur-sm flex items-center justify-center z-[70] p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="glass-shard rounded-3xl w-full max-w-sm p-8 space-y-6 text-center">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/55">Profile</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass-shard flex items-center justify-center text-on-surface/65 hover:text-on-surface transition">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Avatar name={memberName} size="xl" className="ring-4 ring-white shadow-lg" />
          <h2 className="font-display-lg text-2xl text-on-surface">{memberName}</h2>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="w-full py-3 rounded-full bg-on-surface text-white font-mono text-[11px] uppercase tracking-widest disabled:opacity-50 transition"
          >
            {loading ? 'Uploading…' : 'Upload Photo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />

          {hasCustomAvatar && (
            <button
              onClick={handleRemove}
              disabled={loading}
              className="w-full py-3 rounded-full glass-shard font-mono text-[11px] uppercase tracking-widest text-red-500 disabled:opacity-50 transition"
            >
              Remove Photo
            </button>
          )}
        </div>

        {error && <p className="font-mono text-xs text-red-500">{error}</p>}

        <button
          onClick={onSignOut}
          className="w-full py-3 rounded-full glass-shard font-mono text-[11px] uppercase tracking-widest text-on-surface/75 hover:text-on-surface transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
