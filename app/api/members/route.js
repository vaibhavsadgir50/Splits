import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('members')
    .select('name')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.map((r) => r.name))
}

export async function POST(request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { error } = await supabase.from('members').insert({ name })

  if (error) {
    const status = error.code === '23505' ? 400 : 500
    const detail = error.code === '23505' ? 'Member already exists' : error.message
    return NextResponse.json({ error: detail }, { status })
  }

  return NextResponse.json({ message: `Added ${name}` })
}
