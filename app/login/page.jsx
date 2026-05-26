'use client'

import { useState, useEffect } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Already logged in? redirect away
    getBrowserSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/'
    })
  }, [])

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
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 clay mx-auto flex items-center justify-center">
            <span className="text-white font-black text-lg tracking-tight">SP</span>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-widest bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              SPLITS
            </h1>
            <p className="text-gray-500 text-sm mt-1 font-medium">Household receipt ledger</p>
          </div>
        </div>

        {/* Card */}
        <div className="clay bg-white/90 rounded-4xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-black text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to manage your household splits</p>
          </div>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl clay-sm bg-white border border-brand-100 font-bold text-gray-800 hover:bg-brand-50 disabled:opacity-50 transition active:scale-95"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {error && (
            <div className="clay-inset bg-red-50 rounded-2xl px-4 py-3">
              <p className="text-red-500 text-sm font-medium text-center">{error}</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 font-medium">
          Sign in to view and manage your household expenses
        </p>
      </div>
    </div>
  )
}
