import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'

// GET /api/auth — current user + every ledger their email is linked to
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
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
