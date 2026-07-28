import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase'

async function getAuthedMemberName() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const db = getSupabase()
  const { data: member } = await db.from('members').select('name').eq('email', user.email).maybeSingle()
  return member?.name ?? null
}

// POST /api/profile/avatar — upload/replace the signed-in user's own avatar photo
export async function POST(request) {
  const memberName = await getAuthedMemberName()
  if (!memberName) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { image } = await request.json()
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid image' }, { status: 400 })
  }
  if (image.length > 400_000) {
    return NextResponse.json({ error: 'Image too large' }, { status: 400 })
  }

  const db = getSupabase()
  const { error } = await db.from('members').update({ avatar_url: image }).eq('name', memberName)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ avatar_url: image })
}

// DELETE /api/profile/avatar — remove the signed-in user's own custom photo, reverting to the cartoon default
export async function DELETE() {
  const memberName = await getAuthedMemberName()
  if (!memberName) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = getSupabase()
  const { error } = await db.from('members').update({ avatar_url: null }).eq('name', memberName)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
