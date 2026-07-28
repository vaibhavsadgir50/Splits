import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'
import { DEV_AUTH_COOKIE } from '@/lib/serverAuth'

function refuseInProduction() {
  return process.env.NODE_ENV === 'production'
    ? NextResponse.json({ error: 'Not available in production' }, { status: 403 })
    : null
}

// GET /api/dev-login — list real member emails to impersonate, for a quick picker
export async function GET() {
  const refused = refuseInProduction()
  if (refused) return refused

  const db = getSupabase()
  const { data } = await db
    .from('members')
    .select('name, email, ledgers(name)')
    .not('email', 'is', null)
    .neq('email', '')
    .order('created_at', { ascending: true })

  const people = (data ?? []).map((m) => ({
    name: m.name,
    email: m.email,
    ledgerName: m.ledgers?.name ?? 'Household',
  }))

  return NextResponse.json({ people })
}

// POST /api/dev-login { email } — impersonate that email without real Google OAuth
export async function POST(request) {
  const refused = refuseInProduction()
  if (refused) return refused

  const { email } = await request.json()
  const trimmed = (email || '').trim().toLowerCase()
  if (!trimmed) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const cookieStore = await cookies()
  cookieStore.set(DEV_AUTH_COOKIE, trimmed, { httpOnly: true, sameSite: 'lax', path: '/' })
  return NextResponse.json({ ok: true })
}

// DELETE /api/dev-login — clear the impersonation
export async function DELETE() {
  const refused = refuseInProduction()
  if (refused) return refused

  const cookieStore = await cookies()
  cookieStore.delete(DEV_AUTH_COOKIE)
  return NextResponse.json({ ok: true })
}
