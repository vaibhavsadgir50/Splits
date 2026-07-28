'use client'

import { useRouter } from 'next/navigation'
import { useAccount } from '@/contexts/AccountContext'
import UploadStep from './UploadStep'

export default function ScanScreen() {
  const router = useRouter()
  const { ledgerId, members, membersLoading, paidBy, setPaidBy, setDraftReceipt } = useAccount()

  function goToReview(draft) {
    setDraftReceipt(draft)
    router.push(`/account/${ledgerId}/review`)
  }

  function handleParsed({ items, receipt_id, store_name }) {
    goToReview({
      receiptId: receipt_id,
      storeName: store_name || '',
      items: items.map((i) => ({
        name: i.name,
        price: i.price ?? 0,
        confidence: i.confidence ?? 'high',
        category: i.category ?? 'other',
        image_url: i.image_url ?? null,
      })),
      assignments: Object.fromEntries(items.map((_, idx) => [idx, new Set(members)])),
    })
  }

  function handleManual({ storeName: manualStore = '', total: manualTotal = 0 } = {}) {
    goToReview({
      receiptId: `MAN-${Date.now()}`,
      storeName: manualStore,
      items: [{ name: '', price: Number(manualTotal) || 0 }],
      assignments: { 0: new Set(members) },
    })
  }

  return (
    <div className="fixed inset-0 z-50 prism-bg overflow-y-auto">
      <UploadStep
        members={members}
        membersLoading={membersLoading}
        paidBy={paidBy}
        onPaidByChange={setPaidBy}
        onParsed={handleParsed}
        onManual={handleManual}
        onClose={() => router.back()}
        ledgerId={ledgerId}
      />
    </div>
  )
}
