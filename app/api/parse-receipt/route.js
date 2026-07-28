import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { parseReceiptImage } from '@/lib/gemini'

export const maxDuration = 60

export async function POST(request) {
  const supabase = getSupabase()
  const formData = await request.formData()
  const file = formData.get('file')
  const ledgerId = formData.get('ledger_id')

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ledgerId) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mimeType = file.type || 'image/jpeg'

  // ── RAG context: recent unique items from this ledger, fed to Gemini as grounding ─
  let ragContext = ''
  try {
    const { data: recentItems } = await supabase
      .from('items')
      .select('name, price')
      .eq('ledger_id', ledgerId)
      .order('created_at', { ascending: false })
      .limit(60)

    if (recentItems?.length) {
      const seen = new Map()
      for (const item of recentItems) {
        if (!seen.has(item.name)) seen.set(item.name, item.price)
      }
      ragContext = [...seen.entries()]
        .slice(0, 25)
        .map(([name, price]) => `${name} ($${price})`)
        .join(', ')
    }
  } catch {
    // Non-fatal — proceed without RAG context
  }

  try {
    const { store, items } = await parseReceiptImage(base64, mimeType, ragContext)
    const receiptCode = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()

    // Product photos are resolved lazily by the client (GET /api/item-image,
    // one call per item, in parallel) instead of blocking this response —
    // Open Food Facts/DuckDuckGo/Bing are free scraped/best-effort sources
    // that can be slow, so this response only ever waits on Gemini.
    return NextResponse.json({ items, store_name: store ?? '', receipt_id: receiptCode })
  } catch (err) {
    return NextResponse.json(
      { error: 'Receipt parsing failed: ' + err.message },
      { status: 500 }
    )
  }
}
