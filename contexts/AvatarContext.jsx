'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AvatarContext = createContext({ avatarMap: {}, refreshAvatars: () => {} })

export function AvatarProvider({ ledgerId, children }) {
  const [avatarMap, setAvatarMap] = useState({})

  const refreshAvatars = useCallback(() => {
    if (!ledgerId) { setAvatarMap({}); return }
    fetch(`/api/avatars?ledger_id=${encodeURIComponent(ledgerId)}`)
      .then((r) => r.json())
      .then(setAvatarMap)
      .catch(() => {})
  }, [ledgerId])

  useEffect(() => { refreshAvatars() }, [refreshAvatars])

  return (
    <AvatarContext.Provider value={{ avatarMap, refreshAvatars }}>
      {children}
    </AvatarContext.Provider>
  )
}

export function useAvatars() {
  return useContext(AvatarContext)
}
