import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'

// GET /api/auth — current user + their linked member name
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
  if (!user) return NextResponse.json({ user: null, member: null })

  const db = getSupabase()
  const { data: member } = await db
    .from('members')
    .select('name')
    .eq('email', user.email)
    .maybeSingle()

  return NextResponse.json({ user: { email: user.email, name: user.user_metadata?.full_name }, member: member?.name ?? null })
}

// POST /api/auth — link current user's email to a member name
export async function POST(request) {
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
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { memberName, createNew } = await request.json()
  if (!memberName?.trim()) return NextResponse.json({ error: 'memberName required' }, { status: 400 })

  const db = getSupabase()

  if (createNew) {
    // Insert new member with email
    const { error } = await db.from('members').insert({ name: memberName.trim(), email: user.email })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Link email to existing member
    const { error } = await db.from('members').update({ email: user.email }).eq('name', memberName.trim())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, member: memberName.trim() })
}
