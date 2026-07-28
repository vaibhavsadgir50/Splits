import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabase } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/serverAuth'

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)
}

async function uniqueInviteCode(db) {
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode()
    const { data } = await db.from('ledgers').select('id').eq('invite_code', code).maybeSingle()
    if (!data) return code
  }
  throw new Error('Could not generate a unique invite code')
}

// POST /api/ledgers — create a new ledger and add the signed-in user as its first member
export async function POST(request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { ledgerName, memberName } = await request.json()
  const trimmedLedger = (ledgerName || '').trim()
  const trimmedMember = (memberName || '').trim()
  if (!trimmedLedger) return NextResponse.json({ error: 'Account name is required' }, { status: 400 })
  if (!trimmedMember) return NextResponse.json({ error: 'Your name is required' }, { status: 400 })

  const db = getSupabase()
  const inviteCode = await uniqueInviteCode(db)

  const { data: ledger, error: ledgerErr } = await db
    .from('ledgers')
    .insert({ name: trimmedLedger, invite_code: inviteCode })
    .select('id, name, invite_code')
    .single()

  if (ledgerErr) return NextResponse.json({ error: ledgerErr.message }, { status: 500 })

  const { error: memberErr } = await db
    .from('members')
    .insert({ name: trimmedMember, email: user.email, ledger_id: ledger.id })

  if (memberErr) {
    // Roll back the orphaned ledger rather than leaving it memberless
    await db.from('ledgers').delete().eq('id', ledger.id)
    return NextResponse.json({ error: memberErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ledger_id: ledger.id,
    ledger_name: ledger.name,
    invite_code: ledger.invite_code,
    member_name: trimmedMember,
  })
}
