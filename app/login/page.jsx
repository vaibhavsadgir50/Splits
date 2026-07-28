'use client'

import { useState, useEffect } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

const IS_DEV = process.env.NODE_ENV !== 'production'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devPeople, setDevPeople] = useState([])
  const [devEmail, setDevEmail] = useState('')
  const [devLoading, setDevLoading] = useState(false)

  useEffect(() => {
    // Already logged in? redirect away
    getBrowserSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/'
    })
  }, [])

  useEffect(() => {
    if (!IS_DEV) return
    fetch('/api/dev-login')
      .then((r) => r.json())
      .then((d) => setDevPeople(d.people ?? []))
      .catch(() => {})
  }, [])

  async function signInAsDev(email) {
    if (!email.trim()) return
    setDevLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      window.location.href = '/'
    } catch (err) {
      setError(err.message || 'Dev sign-in failed')
      setDevLoading(false)
    }
  }

  async function signInWithGoogle() {
    setLoading(true)
    setError('')
    const supabase = getBrowserSupabase()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-10">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto glass-shard rounded-full flex items-center justify-center">
            <span className="font-display-lg text-lg italic">S</span>
          </div>
          <div>
            <h1 className="font-display-lg text-4xl text-on-surface shimmer-text">Splits</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface/65 mt-2">Household Receipt Ledger</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-shard rounded-3xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="font-display-lg text-xl text-on-surface">Welcome back</h2>
            <p className="text-on-surface/75 text-sm mt-1">Sign in to manage your household splits</p>
          </div>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full glass-shard font-mono text-[11px] uppercase tracking-widest text-on-surface hover:scale-[1.02] disabled:opacity-50 transition active:scale-95"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-on-surface/20 border-t-on-surface rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {error && (
            <p className="font-mono text-xs text-red-500 text-center">{error}</p>
          )}
        </div>

        <p className="text-center font-mono text-[9px] uppercase tracking-[0.2em] text-on-surface/55">
          Sign in to view and manage your household expenses
        </p>

        {/* Dev-only bypass — impersonates a real member's email without a
            Google OAuth round-trip. Never rendered in production. */}
        {IS_DEV && (
          <div className="glass-shard rounded-3xl p-6 space-y-4 border border-dashed border-amber-500/40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-amber-600">construction</span>
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-600">Dev sign-in (not in production)</p>
            </div>

            {devPeople.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {devPeople.map((p) => (
                  <button
                    key={p.email}
                    onClick={() => signInAsDev(p.email)}
                    disabled={devLoading}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-full glass-shard text-left hover:scale-[1.01] disabled:opacity-50 transition"
                  >
                    <span className="text-sm font-semibold text-on-surface">{p.name}</span>
                    <span className="font-mono text-[9px] text-on-surface/55">{p.ledgerName}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="any-email@example.com"
                className="flex-1 glass-shard rounded-full px-4 py-2.5 text-sm focus:outline-none placeholder:text-on-surface/45"
              />
              <button
                onClick={() => signInAsDev(devEmail)}
                disabled={devLoading || !devEmail.trim()}
                className="px-4 py-2.5 rounded-full bg-amber-600 text-white font-mono text-[10px] uppercase tracking-widest disabled:opacity-40 transition"
              >
                Go
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
