'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AccountContext = createContext(null)

// Shared client state for everything under /account/[id] — mounted once in
// the account layout, so it survives client-side navigation between the
// balances/members/history/scan/review pages without re-fetching or losing
// in-progress state (e.g. a receipt draft between the scan and review steps).
export function AccountProvider({ ledgerId, initialLedgerName, memberName, children }) {
  const [ledgerName, setLedgerName] = useState(initialLedgerName)
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [paidBy, setPaidBy] = useState('')
  const [draftReceipt, setDraftReceipt] = useState(null)

  const refreshMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await fetch(`/api/members?ledger_id=${encodeURIComponent(ledgerId)}`)
      const data = await res.json()
      setMembers(data)
      setPaidBy((prev) => prev || data[0] || '')
    } catch {
      // Supabase not connected yet
    } finally {
      setMembersLoading(false)
    }
  }, [ledgerId])

  useEffect(() => { refreshMembers() }, [refreshMembers])

  return (
    <AccountContext.Provider
      value={{
        ledgerId,
        ledgerName,
        setLedgerName,
        memberName,
        members,
        membersLoading,
        refreshMembers,
        paidBy,
        setPaidBy,
        draftReceipt,
        setDraftReceipt,
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider')
  return ctx
}
