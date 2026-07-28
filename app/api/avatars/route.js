import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request) {
  const ledgerId = new URL(request.url).searchParams.get('ledger_id')
  if (!ledgerId) return NextResponse.json({})

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('members')
    .select('name, avatar_url')
    .eq('ledger_id', ledgerId)
    .not('avatar_url', 'is', null)

  if (error) return NextResponse.json({})

  const map = {}
  data.forEach((r) => { if (r.avatar_url) map[r.name] = r.avatar_url })
  return NextResponse.json(map)
}
