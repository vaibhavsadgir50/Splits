import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request) {
  const ledgerId = new URL(request.url).searchParams.get('ledger_id')
  if (!ledgerId) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('members')
    .select('name')
    .eq('ledger_id', ledgerId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.map((r) => r.name))
}

export async function POST(request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  const ledgerId = searchParams.get('ledger_id')

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!ledgerId) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })

  const { error } = await supabase.from('members').insert({ name, ledger_id: ledgerId })

  if (error) {
    const status = error.code === '23505' ? 400 : 500
    const detail = error.code === '23505' ? 'Member already exists' : error.message
    return NextResponse.json({ error: detail }, { status })
  }

  return NextResponse.json({ message: `Added ${name}` })
}
