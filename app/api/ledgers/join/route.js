import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/serverAuth'

// GET /api/ledgers/join?code=XXXXXX — look up a ledger by invite code and
// return its current member list, so the client can show the pick-or-create UI.
export async function GET(request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const code = new URL(request.url).searchParams.get('code')?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

  const db = getSupabase()
  const { data: ledger, error: findErr } = await db
    .from('ledgers')
    .select('id, name')
    .eq('invite_code', code)
    .maybeSingle()

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!ledger) return NextResponse.json({ error: 'No account found for that invite code' }, { status: 404 })

  const { data: members, error: membersErr } = await db
    .from('members')
    .select('name')
    .eq('ledger_id', ledger.id)
    .order('created_at', { ascending: true })

  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 })

  return NextResponse.json({
    ledger_id: ledger.id,
    ledger_name: ledger.name,
    members: (members ?? []).map((m) => m.name),
  })
}

// POST /api/ledgers/join — join an already-resolved ledger (the client
// resolves invite code → ledger_id via the GET above first), either
// claiming an existing unclaimed member name or creating a new one.
export async function POST(request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { ledger_id, memberName, createNew } = await request.json()
  const trimmedMember = (memberName || '').trim()
  if (!ledger_id) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })
  if (!trimmedMember) return NextResponse.json({ error: 'Choose or enter a name' }, { status: 400 })

  const db = getSupabase()
  const { data: ledger, error: findErr } = await db
    .from('ledgers')
    .select('id, name')
    .eq('id', ledger_id)
    .maybeSingle()

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!ledger) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  if (createNew) {
    const { error } = await db
      .from('members')
      .insert({ name: trimmedMember, email: user.email, ledger_id: ledger.id })
    if (error) {
      const detail = error.code === '23505' ? 'That name is already taken in this account' : error.message
      return NextResponse.json({ error: detail }, { status: error.code === '23505' ? 400 : 500 })
    }
  } else {
    const { error } = await db
      .from('members')
      .update({ email: user.email })
      .eq('name', trimmedMember)
      .eq('ledger_id', ledger.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ledger_id: ledger.id, ledger_name: ledger.name, member_name: trimmedMember })
}
