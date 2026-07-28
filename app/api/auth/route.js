import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/serverAuth'

// GET /api/auth — current user + every ledger their email is linked to
export async function GET() {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ user: null, ledgers: [] })

  const db = getSupabase()
  const { data: memberships } = await db
    .from('members')
    .select('name, ledger_id, ledgers(name)')
    .eq('email', user.email)

  const ledgers = (memberships ?? []).map((m) => ({
    ledger_id: m.ledger_id,
    ledger_name: m.ledgers?.name ?? 'Household',
    member_name: m.name,
  }))

  return NextResponse.json({
    user: { email: user.email, name: user.user_metadata?.full_name },
    ledgers,
  })
}
