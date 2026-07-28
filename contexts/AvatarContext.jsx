'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AvatarContext = createContext({ avatarMap: {}, refreshAvatars: () => {} })

export function AvatarProvider({ children }) {
  const [avatarMap, setAvatarMap] = useState({})

  const refreshAvatars = useCallback(() => {
    fetch('/api/avatars')
      .then((r) => r.json())
      .then(setAvatarMap)
      .catch(() => {})
  }, [])

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
