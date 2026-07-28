import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// GET /api/spending-stats
// Two modes:
//   ?email=X              — cross-ledger personal aggregate (every ledger
//                            this email belongs to, summed together)
//   ?ledger_id=X&member=Y — single-ledger totals
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const ledgerId = searchParams.get('ledger_id')
  const member = searchParams.get('member')

  const supabase = getSupabase()

  let pairs = []
  if (email) {
    const { data: memberships, error } = await supabase
      .from('members')
      .select('ledger_id, name')
      .eq('email', email)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    pairs = memberships ?? []
  } else if (ledgerId && member) {
    pairs = [{ ledger_id: ledgerId, name: member }]
  } else {
    return NextResponse.json({ error: 'Provide either email, or ledger_id + member' }, { status: 400 })
  }

  const rows = []
  for (const pair of pairs) {
    const { data, error } = await supabase
      .from('items')
      .select('per_person_amt, category, created_at, split_with')
      .eq('ledger_id', pair.ledger_id)
      .contains('split_with', [pair.name])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...(data ?? []))
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  let today = 0
  let week = 0
  let year = 0
  const byCategory = {}

  for (const row of rows) {
    const amt = parseFloat(row.per_person_amt) || 0
    const createdAt = new Date(row.created_at)
    if (createdAt >= startOfToday) today += amt
    if (createdAt >= startOfWeek) week += amt
    if (createdAt >= startOfYear) year += amt

    const cat = row.category || 'other'
    byCategory[cat] = (byCategory[cat] || 0) + amt
  }

  const byCategoryList = Object.entries(byCategory)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return NextResponse.json({
    today: Math.round(today * 100) / 100,
    week: Math.round(week * 100) / 100,
    year: Math.round(year * 100) / 100,
    byCategory: byCategoryList,
  })
}
