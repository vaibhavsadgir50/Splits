import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/gemini'
import { generateReceiptPDF } from '@/lib/pdf'
import { sendReceiptEmail } from '@/lib/email'

export const maxDuration = 60

export async function POST(request) {
  const supabase = getSupabase()
  const body = await request.json()
  const { receipt_id, paid_by, items, notes = '', store_name = '', ledger_id } = body

  if (!receipt_id || !paid_by || !items?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!ledger_id) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })

  // 1. Insert receipt
  const { data: receipt, error: rErr } = await supabase
    .from('receipts')
    .insert({ receipt_code: receipt_id, paid_by, notes, store_name, ledger_id })
    .select('id, created_at')
    .single()

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

  // 2. Insert items and calculate per-person shares
  const summary = {}
  const itemRows = []

  for (const item of items) {
    if (!item.split_with?.length || !item.name) continue
    const perPerson = Math.round((item.price / item.split_with.length) * 100) / 100
    itemRows.push({
      receipt_id: receipt.id,
      name: item.name,
      price: item.price,
      split_with: item.split_with,
      per_person_amt: perPerson,
      category: item.category || null,
      ledger_id,
    })
    for (const person of item.split_with) {
      if (person !== paid_by) {
        summary[person] = (summary[person] ?? 0) + perPerson
      }
    }
  }

  const { data: insertedItems, error: iErr } = await supabase
    .from('items')
    .insert(itemRows)
    .select('id, name, price')

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })

  // 3. Fire-and-forget: embeddings + emails
  const allMembers = [...new Set(items.flatMap((i) => i.split_with))]
  generateAndStoreEmbeddings(supabase, insertedItems, receipt_id, ledger_id).catch(console.error)
  sendPersonalizedEmails({ supabase, items, allMembers, paid_by, store_name, receipt_id, date: receipt.created_at, ledgerId: ledger_id }).catch(console.error)

  return NextResponse.json({
    message: 'Saved successfully',
    receipt_id,
    paid_by,
    summary: Object.fromEntries(
      Object.entries(summary).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
  })
}

async function sendPersonalizedEmails({ supabase, items, allMembers, paid_by, store_name, receipt_id, date, ledgerId }) {
  // Fetch emails for all members in this receipt (scoped to this ledger —
  // the same name can exist in a different ledger with a different email)
  const { data: memberRecords } = await supabase
    .from('members')
    .select('name, email')
    .eq('ledger_id', ledgerId)
    .in('name', allMembers)

  if (!memberRecords?.length) return

  for (const member of memberRecords) {
    if (!member.email) continue

    // Items assigned to this member
    const myItems = items
      .filter((i) => i.split_with?.includes(member.name))
      .map((i) => ({
        name: i.name,
        price: i.price,
        splitWith: i.split_with,
        share: Math.round((i.price / i.split_with.length) * 100) / 100,
      }))

    if (!myItems.length) continue

    const total = myItems.reduce((s, i) => s + i.share, 0)
    const isSelf = member.name === paid_by

    try {
      const pdfBuffer = await generateReceiptPDF({
        memberName: member.name,
        paidBy: paid_by,
        storeName: store_name,
        receiptCode: receipt_id,
        date,
        items: myItems,
        total: Math.round(total * 100) / 100,
        isSelf,
      })

      await sendReceiptEmail({
        to: member.email,
        memberName: member.name,
        paidBy: paid_by,
        storeName: store_name,
        receiptCode: receipt_id,
        total: Math.round(total * 100) / 100,
        isSelf,
        pdfBuffer,
      })
    } catch (err) {
      console.error(`Email failed for ${member.name}:`, err.message)
    }
  }
}

async function generateAndStoreEmbeddings(supabase, items, receiptCode, ledgerId) {
  const embedRows = []
  for (const item of items) {
    try {
      const embedding = await generateEmbedding(item.name)
      embedRows.push({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        receipt_code: receiptCode,
        embedding: JSON.stringify(embedding),
        ledger_id: ledgerId,
      })
    } catch {
      // Skip individual embedding failures silently
    }
  }
  if (embedRows.length) {
    await supabase.from('item_embeddings').insert(embedRows)
  }
}
