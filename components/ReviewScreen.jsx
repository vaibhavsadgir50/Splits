'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from '@/contexts/AccountContext'
import ReviewStep from './ReviewStep'
import SummaryStep from './SummaryStep'

export default function ReviewScreen() {
  const router = useRouter()
  const { ledgerId, members, paidBy, draftReceipt, setDraftReceipt } = useAccount()
  const [items, setItems] = useState(draftReceipt?.items ?? [])
  const [assignments, setAssignments] = useState(draftReceipt?.assignments ?? {})
  const [summary, setSummary] = useState(null)

  // No draft in memory — e.g. a direct refresh on this URL. Nothing to
  // review, so bounce back to the account's balances page.
  useEffect(() => {
    if (!draftReceipt) router.replace(`/account/${ledgerId}`)
  }, [draftReceipt, ledgerId, router])

  // Keep the in-progress edits synced back into shared context so they
  // survive a detour to the scan screen and back (e.g. tapping "Back").
  useEffect(() => {
    if (!draftReceipt) return
    setDraftReceipt((prev) => (prev ? { ...prev, items, assignments } : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, assignments])

  if (!draftReceipt) return null

  function handleSubmitted(result) {
    setSummary(result)
  }

  function handleReset() {
    setDraftReceipt(null)
    router.push(`/account/${ledgerId}`)
  }

  if (summary) {
    return (
      <main className="flex-1 max-w-lg w-full mx-auto px-6 pt-32 pb-16">
        <SummaryStep summary={summary} receiptId={draftReceipt.receiptId} onReset={handleReset} />
      </main>
    )
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 pt-32 pb-16">
      <ReviewStep
        members={members}
        paidBy={paidBy}
        receiptId={draftReceipt.receiptId}
        storeName={draftReceipt.storeName}
        items={items}
        onItemsChange={setItems}
        assignments={assignments}
        onAssignmentsChange={setAssignments}
        onSubmitted={handleSubmitted}
        onBack={() => router.push(`/account/${ledgerId}/scan`)}
        onDiscard={handleReset}
        ledgerId={ledgerId}
      />
    </main>
  )
}
