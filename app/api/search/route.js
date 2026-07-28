import { NextResponse } from 'next/server'
import { webSearch } from '@/lib/webSearch'
import { rankSearchResults } from '@/lib/searchRank'

export const maxDuration = 30

// GET /api/search?q=... — our own independent web search for the Splits
// agent. Scrapes multiple engines in parallel (no single provider's rate
// limit can take the whole thing down), then Gemini re-ranks/filters the
// real scraped candidates down to what's actually relevant.
export async function GET(request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query) return NextResponse.json({ error: 'q is required' }, { status: 400 })

  const { results, engineStatus } = await webSearch(query, { limit: 8 })
  if (!results.length) {
    return NextResponse.json({ query, results: [], engineStatus })
  }

  try {
    const ranked = await rankSearchResults(query, results)
    return NextResponse.json({ query, results: ranked, engineStatus })
  } catch (err) {
    // Ranking failed (e.g. Gemini down) — fall back to raw scraped results
    // rather than failing the whole search.
    return NextResponse.json({ query, results, engineStatus, rankingError: err.message })
  }
}
