import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { resolveItemImageCached } from '@/lib/productImages'

export const maxDuration = 20

// GET /api/item-image?name=...&raw_name=... — resolves one item's product
// photo (cached in Supabase). Called lazily per-item from the client after
// a receipt parses, so a slow/flaky image source never blocks getting the
// parsed items themselves onto the review screen.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  const rawName = searchParams.get('raw_name')?.trim() || name
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const supabase = getSupabase()
  const result = await resolveItemImageCached(supabase, { name, raw_name: rawName })
  return NextResponse.json(result)
}
