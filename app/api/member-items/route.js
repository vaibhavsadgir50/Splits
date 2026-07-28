import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const member = searchParams.get('member')
  const ledgerId = searchParams.get('ledger_id')
  if (!member) return NextResponse.json({ error: 'member required' }, { status: 400 })
  if (!ledgerId) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('items')
    .select('name, price, per_person_amt, split_with, receipt:receipt_id(receipt_code, paid_by, created_at)')
    .eq('ledger_id', ledgerId)
    .contains('split_with', [member])
    .order('created_at', { referencedTable: 'receipt', ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
