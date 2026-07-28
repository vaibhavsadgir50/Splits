import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function DELETE(request, { params }) {
  const supabase = getSupabase()
  const { name } = await params
  const ledgerId = new URL(request.url).searchParams.get('ledger_id')

  if (!ledgerId) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })

  const { error } = await supabase.from('members').delete().eq('name', name).eq('ledger_id', ledgerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: `Removed ${name}` })
}
