import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const member = searchParams.get('member')
  if (!member) return NextResponse.json({ error: 'member is required' }, { status: 400 })

  const supabase = getSupabase()
  let { data, error } = await supabase
    .from('items')
    .select('per_person_amt, category, created_at, split_with')
    .contains('split_with', [member])

  // `category` may not exist yet if the item_images/category migration hasn't
  // been run — degrade to totals-only (no category breakdown) instead of failing.
  if (error) {
    const fallback = await supabase
      .from('items')
      .select('per_person_amt, created_at, split_with')
      .contains('split_with', [member])
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    data = fallback.data
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  let today = 0
  let week = 0
  let year = 0
  const byCategory = {}

  for (const row of data || []) {
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
