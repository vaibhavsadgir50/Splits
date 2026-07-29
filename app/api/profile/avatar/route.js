import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/serverAuth'
import { MEMOJI_FILES } from '@/lib/avatars'

async function getAuthedMemberName(ledgerId) {
  const user = await getAuthedUser()
  if (!user || !ledgerId) return null

  const db = getSupabase()
  const { data: member } = await db
    .from('members')
    .select('name')
    .eq('email', user.email)
    .eq('ledger_id', ledgerId)
    .maybeSingle()
  return member?.name ?? null
}

// POST /api/profile/avatar — upload/replace the signed-in user's own avatar photo, within one ledger
export async function POST(request) {
  const { image, ledger_id } = await request.json()
  const memberName = await getAuthedMemberName(ledger_id)
  if (!memberName) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const isUploadedPhoto = typeof image === 'string' && image.startsWith('data:image/')
  const isMemojiPick = typeof image === 'string' && MEMOJI_FILES.includes(image.replace(/^\/memoji\//, ''))
  if (!isUploadedPhoto && !isMemojiPick) {
    return NextResponse.json({ error: 'Invalid image' }, { status: 400 })
  }
  if (isUploadedPhoto && image.length > 400_000) {
    return NextResponse.json({ error: 'Image too large' }, { status: 400 })
  }

  const db = getSupabase()
  const { error } = await db.from('members').update({ avatar_url: image }).eq('name', memberName).eq('ledger_id', ledger_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ avatar_url: image })
}

// DELETE /api/profile/avatar — remove the signed-in user's own custom photo, reverting to the cartoon default
export async function DELETE(request) {
  const ledgerId = new URL(request.url).searchParams.get('ledger_id')
  const memberName = await getAuthedMemberName(ledgerId)
  if (!memberName) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = getSupabase()
  const { error } = await db.from('members').update({ avatar_url: null }).eq('name', memberName).eq('ledger_id', ledgerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
