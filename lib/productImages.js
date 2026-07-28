// Free, key-less product image lookup.
// 1. Open Food Facts — official public API, reliable for branded/packaged goods.
// 2. DuckDuckGo image search — undocumented endpoint, best-effort fallback for
//    everything else (produce, meat, household, personal care). Can break or
//    get rate-limited without notice since it's not an official API.

function significantWords(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
}

function isRelevantMatch(query, candidateText) {
  const queryWords = significantWords(query)
  const candidateWords = new Set(significantWords(candidateText))
  return queryWords.some((w) => candidateWords.has(w))
}

async function fetchOpenFoodFactsOnce(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`
  const res = await fetch(url, { headers: { 'User-Agent': 'Splits-App/1.0' } })
  if (!res.ok) return null
  return res.json()
}

// Open Food Facts is intermittently flaky (returns a 503 "temporarily
// unavailable" HTML page under load) — one quick retry meaningfully improves
// the real hit rate.
async function searchOpenFoodFacts(query) {
  try {
    let data = await fetchOpenFoodFactsOnce(query)
    if (!data) {
      await new Promise((r) => setTimeout(r, 400))
      data = await fetchOpenFoodFactsOnce(query)
    }
    if (!data) return null
    for (const p of data.products || []) {
      const image = p.image_front_small_url || p.image_url
      if (!image) continue
      const candidateText = `${p.product_name || ''} ${p.brands || ''}`
      if (isRelevantMatch(query, candidateText)) {
        return { image_url: image, source: 'openfoodfacts' }
      }
    }
    return null
  } catch {
    return null
  }
}

function extractCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const cookies = res.headers.getSetCookie()
    if (cookies?.length) return cookies.map((c) => c.split(';')[0]).join('; ')
  }
  const raw = res.headers.get('set-cookie')
  return raw ? raw.split(',').map((c) => c.split(';')[0]).join('; ') : null
}

async function searchDuckDuckGo(query) {
  try {
    const homeRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = await homeRes.text()
    const match = html.match(/vqd=["']([\d-]+)["']/) || html.match(/vqd=([\d-]+)&/)
    const vqd = match?.[1]
    if (!vqd) return null
    const cookie = extractCookie(homeRes)

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://duckduckgo.com/',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      }
    )
    if (!imgRes.ok) return null
    const data = await imgRes.json()
    const first = data.results?.[0]
    if (!first?.image) return null
    return { image_url: first.image, source: 'duckduckgo' }
  } catch {
    return null
  }
}

// Resolves {image_url, source} for a single item — never throws.
export async function resolveItemImage(item) {
  const rawQuery = (item.raw_name || item.name || '').trim()
  const cleanQuery = (item.name || rawQuery).trim()
  if (!rawQuery) return { image_url: null, source: 'none' }

  const offResult = await searchOpenFoodFacts(rawQuery)
  if (offResult) return offResult

  const ddgResult = await searchDuckDuckGo(`${cleanQuery} product`)
  if (ddgResult) return ddgResult

  return { image_url: null, source: 'none' }
}

// Same as resolveItemImage, but checks/writes a Supabase cache first so a
// repeat item (e.g. "Bananas" on next week's receipt) never gets re-queried.
export async function resolveItemImageCached(supabase, item) {
  const key = (item.raw_name || item.name || '').trim().toLowerCase()
  if (!key) return { image_url: null, source: 'none' }

  const { data: cached } = await supabase
    .from('item_images')
    .select('image_url, source')
    .eq('item_key', key)
    .maybeSingle()
  if (cached) return { image_url: cached.image_url, source: cached.source }

  const result = await resolveItemImage(item)
  supabase.from('item_images').insert({ item_key: key, ...result }).then(
    () => {},
    () => {}
  )
  return result
}
