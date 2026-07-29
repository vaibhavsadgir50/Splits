import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/serverAuth'

// GET /api/ledgers/[id] — the ledger's invite code, so an existing member
// can find it to share with someone new. Only a member of that ledger may see it.
export async function GET(request, { params }) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const db = getSupabase()

  const { data: membership } = await db
    .from('members')
    .select('id')
    .eq('ledger_id', id)
    .eq('email', user.email)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Not a member of this account' }, { status: 403 })

  const { data: ledger, error } = await db.from('ledgers').select('name, invite_code').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ledger_name: ledger.name, invite_code: ledger.invite_code })
}

// PATCH /api/ledgers/[id] — rename a ledger. Only a member of that ledger may rename it.
export async function PATCH(request, { params }) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const { ledger_name } = await request.json()
  const trimmed = (ledger_name || '').trim()
  if (!trimmed) return NextResponse.json({ error: 'Account name is required' }, { status: 400 })
  if (trimmed.length > 60) return NextResponse.json({ error: 'Keep it under 60 characters' }, { status: 400 })

  const db = getSupabase()

  const { data: membership } = await db
    .from('members')
    .select('id')
    .eq('ledger_id', id)
    .eq('email', user.email)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Not a member of this account' }, { status: 403 })

  const { error } = await db.from('ledgers').update({ name: trimmed }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ledger_name: trimmed })
}
