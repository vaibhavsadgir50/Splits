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

export default function UploadStep({ members, membersLoading, paidBy, onPaidByChange, onParsed, onManual, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
      const res = await fetch('/api/parse-receipt', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onParsed(data)
    } catch (err) {
      setError(err.message || 'Failed to read receipt. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-900">New Receipt</h2>
        <button
          onClick={onClose}
          disabled={loading}
          className="w-8 h-8 rounded-full clay-sm bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-40 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Who paid */}
      <div>
        <p className="text-sm font-bold text-gray-700 mb-3">Who paid?</p>
        {membersLoading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : members.length === 0 ? (
          <div className="clay-inset bg-amber-50 rounded-2xl px-4 py-3">
            <p className="text-amber-700 text-sm font-medium">Add members first using the Members button.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onPaidByChange(name)}
                className={`px-4 py-2 rounded-2xl text-sm font-bold transition ${
                  paidBy === name
                    ? 'bg-brand-600 text-white clay-btn'
                    : 'bg-brand-50 text-brand-700 clay-sm hover:bg-brand-100'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {loading ? (
        <div className="clay-inset bg-brand-50 rounded-3xl flex flex-col items-center py-8 gap-3">
          <div className="w-10 h-10 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-brand-600">Gemini is reading the receipt…</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={!paidBy || members.length === 0}
            className="clay bg-gradient-to-br from-brand-50 to-brand-100 rounded-3xl flex flex-col items-center gap-2 py-6 disabled:opacity-40 disabled:cursor-not-allowed transition hover:from-brand-100 hover:to-brand-200 active:scale-95"
          >
            <span className="text-4xl">📷</span>
            <span className="text-sm font-bold text-brand-700">Take Photo</span>
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />

          <button
            onClick={() => filesRef.current?.click()}
            disabled={!paidBy || members.length === 0}
            className="clay bg-gradient-to-br from-violet-50 to-purple-100 rounded-3xl flex flex-col items-center gap-2 py-6 disabled:opacity-40 disabled:cursor-not-allowed transition hover:from-violet-100 hover:to-purple-200 active:scale-95"
          >
            <span className="text-4xl">📁</span>
            <span className="text-sm font-bold text-violet-700">From Files</span>
          </button>
          <input ref={filesRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />

          <button
            onClick={onManual}
            disabled={!paidBy || members.length === 0}
            className="col-span-2 clay bg-gradient-to-r from-gray-50 to-gray-100 rounded-3xl flex items-center justify-center gap-3 py-4 disabled:opacity-40 disabled:cursor-not-allowed transition hover:from-gray-100 hover:to-gray-200 active:scale-95"
          >
            <span className="text-2xl">✏️</span>
            <span className="text-sm font-bold text-gray-700">Enter Manually</span>
          </button>
        </div>
      )}

      {error && (
        <div className="clay-inset bg-red-50 rounded-2xl px-4 py-3">
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  )
}
