'use client'

import { useState } from 'react'
import Link from 'next/link'
import Avatar from './Avatar'
import ProfileModal from './ProfileModal'
import { getBrowserSupabase } from '@/lib/supabase-browser'

export default function Header({ avatarName, ledgerId }) {
  const [showProfile, setShowProfile] = useState(false)

  async function handleSignOut() {
    await getBrowserSupabase().auth.signOut()
    if (process.env.NODE_ENV !== 'production') {
      await fetch('/api/dev-login', { method: 'DELETE' }).catch(() => {})
    }
    window.location.href = '/login'
  }

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 pt-safe px-6 mt-4">
        <div className="h-14 px-6 flex items-center justify-between glass-shard rounded-full max-w-lg mx-auto">
          <Link href="/" className="text-xl font-display-lg font-bold tracking-tight text-on-surface hover:opacity-70 transition">
            Splits
          </Link>

          {avatarName && (
            <button
              onClick={() => setShowProfile(true)}
              title="Edit profile"
              className="hover:opacity-80 transition"
            >
              <Avatar name={avatarName} size="xs" />
            </button>
          )}
        </div>
      </header>

      {showProfile && (
        <ProfileModal
          memberName={avatarName}
          ledgerId={ledgerId}
          onClose={() => setShowProfile(false)}
          onSignOut={handleSignOut}
        />
      )}
    </>
  )
}
