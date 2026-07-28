import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data } = await supabase.from('household_settings').select('account_name').eq('id', 1).maybeSingle()
  return NextResponse.json({ account_name: data?.account_name || 'Our Household' })
}

export async function POST(request) {
  const { account_name } = await request.json()
  const trimmed = (account_name || '').trim()
  if (!trimmed) return NextResponse.json({ error: 'Account name is required' }, { status: 400 })
  if (trimmed.length > 60) return NextResponse.json({ error: 'Keep it under 60 characters' }, { status: 400 })

  const supabase = getSupabase()
  const { error } = await supabase
    .from('household_settings')
    .upsert({ id: 1, account_name: trimmed, updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account_name: trimmed })
}
