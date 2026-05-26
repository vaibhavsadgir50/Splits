import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(req) {
  const member = new URL(req.url).searchParams.get('member')
  if (!member) return NextResponse.json({ error: 'member required' }, { status: 400 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('items')
    .select('name, price, per_person_amt, split_with, receipt:receipt_id(receipt_code, paid_by, created_at)')
    .contains('split_with', [member])
    .order('created_at', { referencedTable: 'receipt', ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
