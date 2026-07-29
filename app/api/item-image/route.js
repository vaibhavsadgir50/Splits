import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { resolveItemImage, resolveItemImageCached } from '@/lib/productImages'

export const maxDuration = 20
export const dynamic = 'force-dynamic'

// GET /api/item-image?name=...&raw_name=... — resolves one item's product
// photo (cached in Supabase). Called lazily per-item from the client after
// a receipt parses, so a slow/flaky image source never blocks getting the
// parsed items themselves onto the review screen.
//
// ?debug=1 bypasses the cache and returns a step-by-step trace of what each
// image source actually returned — for diagnosing production-only behavior
// (e.g. datacenter IP blocking) without needing dashboard log access.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  const rawName = searchParams.get('raw_name')?.trim() || name
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  if (searchParams.get('debug') === '1') {
    const trace = []
    const result = await resolveItemImage({ name, raw_name: rawName }, trace)
    return NextResponse.json({ ...result, trace })
  }

  const supabase = getSupabase()
  const result = await resolveItemImageCached(supabase, { name, raw_name: rawName })
  return NextResponse.json(result)
}
