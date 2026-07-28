'use client'

import { useState, useRef } from 'react'

async function compressImage(file, maxKB = 2000) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      const maxDim = 2048
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      let quality = 0.9
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (blob.size > maxKB * 1024 && quality > 0.3) {
            quality = Math.max(quality - 0.1, 0.3)
            tryCompress()
          } else {
            resolve(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }))
          }
        }, 'image/jpeg', quality)
      }
      tryCompress()
    }
    img.src = url
  })
}

export default function UploadStep({ members, membersLoading, paidBy, onPaidByChange, onParsed, onManual, onClose, ledgerId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [total, setTotal] = useState('')
  const cameraRef = useRef()
  const filesRef = useRef()

  async function handleFile(file) {
    if (!file) return
    if (!paidBy) { setError('Select who paid first'); return }
    setError('')
    setLoading(true)
    try {
      const compressed = await compressImage(file)
      const form = new FormData()
      form.append('file', compressed)
      form.append('ledger_id', ledgerId)
      const res = await fetch('/api/parse-receipt', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onParsed(data)
    } catch (err) {
      setError(err.message || 'Failed to read receipt. Please try again.')
      setLoading(false)
    }
  }

  const disabled = !paidBy || members.length === 0

  return (
    <div className="min-h-screen flex flex-col px-6 pt-10 pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/65">New Entry</span>
          <h1 className="font-display-lg text-3xl text-on-surface shimmer-text">New Receipt</h1>
        </div>
        <button
          onClick={onClose}
          disabled={loading}
          className="w-9 h-9 rounded-full glass-shard flex items-center justify-center text-on-surface/80 hover:text-on-surface disabled:opacity-40 transition"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Who paid */}
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/75 mb-3">Who paid?</p>
        {membersLoading ? (
          <p className="text-on-surface/65 text-sm">Loading…</p>
        ) : members.length === 0 ? (
          <div className="glass-shard rounded-3xl px-4 py-3">
            <p className="text-on-surface/80 text-sm">Add members first from the Members tab.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onPaidByChange(name)}
                className={`px-4 py-2 rounded-full font-mono text-[11px] uppercase tracking-widest transition ${
                  paidBy === name
                    ? 'bg-on-surface text-white'
                    : 'glass-shard text-on-surface/80 hover:text-on-surface'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Capture area */}
      {loading ? (
        <div className="glass-shard rounded-3xl flex flex-col items-center py-12 gap-3 mb-8">
          <div className="w-9 h-9 border-2 border-on-surface/20 border-t-on-surface rounded-full animate-spin" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface/75">Gemini is reading the receipt…</p>
        </div>
      ) : (
        <div className="glass-shard rounded-3xl p-4 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={disabled}
              className="rounded-3xl border border-on-surface/10 flex flex-col items-center gap-3 py-8 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-on-surface/[0.03] active:scale-95 transition"
            >
              <span className="w-14 h-14 glass-shard rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-on-surface/85">photo_camera</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest">Take Photo</span>
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />

            <button
              onClick={() => filesRef.current?.click()}
              disabled={disabled}
              className="rounded-3xl border border-on-surface/10 flex flex-col items-center gap-3 py-8 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-on-surface/[0.03] active:scale-95 transition"
            >
              <span className="w-14 h-14 glass-shard rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-on-surface/85">image</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest">From Files</span>
            </button>
            <input ref={filesRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {/* Manual entry */}
      <div className="glass-shard rounded-3xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-5">
          <span className="material-symbols-outlined text-[18px] text-on-surface/75">edit_note</span>
          <h3 className="font-display-lg text-lg text-on-surface">Manual Entry</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="font-mono text-[9px] uppercase tracking-widest text-on-surface/65 mb-1 block">
              Merchant Name
            </label>
            <input
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="e.g. Blue Bottle Coffee"
              className="w-full bg-transparent border-b border-on-surface/15 py-2 text-sm focus:outline-none focus:border-primary placeholder:text-on-surface/45 transition"
            />
          </div>
          <div>
            <label className="font-mono text-[9px] uppercase tracking-widest text-on-surface/65 mb-1 block">
              Total
            </label>
            <div className="flex items-center border-b border-on-surface/15 py-2 focus-within:border-primary transition">
              <span className="text-on-surface/65 mr-2 font-mono">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent focus:outline-none font-mono text-lg font-bold placeholder:text-on-surface/45"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="font-mono text-xs text-red-500 mb-8">{error}</p>
      )}

      {/* Fixed primary CTA */}
      <div className="fixed bottom-0 inset-x-0 px-6 pb-8 pt-4 max-w-lg mx-auto">
        <button
          onClick={() => onManual({ storeName: merchantName, total })}
          disabled={disabled}
          className="w-full h-14 rounded-full bg-on-surface text-white font-mono text-[11px] uppercase tracking-[0.2em] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
        >
          Enter Manually
        </button>
      </div>
    </div>
  )
}
