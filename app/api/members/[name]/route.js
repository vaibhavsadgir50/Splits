import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function DELETE(_request, { params }) {
  const supabase = getSupabase()
  const { name } = await params

  const { error } = await supabase.from('members').delete().eq('name', name)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: `Removed ${name}` })
}
