'use client'

import { useState } from 'react'
import { cartoonAvatarUrl, initials } from '@/lib/avatars'
import { useAvatars } from '@/contexts/AvatarContext'

export const AVATAR_SIZES = {
  xs: 'w-7 h-7 text-[9px]',
  sm: 'w-9 h-9 text-[11px]',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
}

export default function Avatar({ name, size = 'md', selected = false, ring = true, className = '' }) {
  const { avatarMap } = useAvatars()
  const [errored, setErrored] = useState(false)
  const src = errored ? null : (avatarMap[name] || cartoonAvatarUrl(name))

  const base = `inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-white transition ${AVATAR_SIZES[size]} ${ring ? 'ring-2 ring-white' : ''} ${selected ? 'ring-[3px] ring-on-surface' : ''} ${className}`

  if (src) {
    return (
      <span className={base}>
        <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErrored(true)} />
      </span>
    )
  }

  return (
    <span className={`${base} font-mono font-bold text-white bg-on-surface`}>
      {initials(name)}
    </span>
  )
}
