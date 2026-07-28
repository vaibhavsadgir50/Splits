import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(request) {
  const supabase = getSupabase()
  const { paid_by, paid_to, amount, note = '', ledger_id } = await request.json()

  if (!paid_by || !paid_to || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }
  if (!ledger_id) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })

  const { error } = await supabase
    .from('settlements')
    .insert({ paid_by, paid_to, amount: parseFloat(amount), note, ledger_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'Settlement recorded' })
}
