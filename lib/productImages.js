// Free, key-less product image lookup, tried in order:
// 1. Open Food Facts — official public API, reliable for branded/packaged goods.
// 2. DuckDuckGo image search — undocumented endpoint, best-effort fallback for
//    everything else (produce, meat, household, personal care).
// 3. Bing image search — second undocumented fallback, independent of DDG, so
//    a DDG-specific block/outage doesn't leave an item imageless.
// Each of 2/3 can break or get rate-limited without notice since neither is
// an official API — that's exactly why there are two of them.
//
// Every external request has a hard timeout: on a serverless host these run
// on shared/datacenter IPs that these free sources are more likely to stall
// or silently hang for than a residential dev machine — without a timeout,
// one slow source can eat the whole function's time budget and take every
// item's image down with it, not just the one that's actually struggling.

const FETCH_TIMEOUT_MS = 4000

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

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
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Splits-App/1.0' } })
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
    const homeRes = await fetchWithTimeout(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = await homeRes.text()
    const match = html.match(/vqd=["']([\d-]+)["']/) || html.match(/vqd=([\d-]+)&/)
    const vqd = match?.[1]
    if (!vqd) return null
    const cookie = extractCookie(homeRes)

    const imgRes = await fetchWithTimeout(
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

async function searchBingImages(query) {
  try {
    const res = await fetchWithTimeout(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/class="iusc"[^>]*m="([^"]+)"/)
    if (!match) return null
    const data = JSON.parse(match[1].replace(/&quot;/g, '"'))
    if (!data.murl) return null
    // Bing occasionally appends a stray "[N]" variant marker to murl that
    // isn't part of the real asset path — strip it if present.
    const cleanUrl = data.murl.replace(/\[\d+\]$/, '')
    return { image_url: cleanUrl, source: 'bing' }
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

  const bingResult = await searchBingImages(`${cleanQuery} product`)
  if (bingResult) return bingResult

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
  // A cached miss (image_url null) is not treated as a hit — Open Food Facts /
  // DuckDuckGo can be down transiently, so a failed lookup should retry next
  // time rather than being remembered as "no image" forever.
  if (cached?.image_url) return { image_url: cached.image_url, source: cached.source }

  const result = await resolveItemImage(item)
  if (result.image_url) {
    supabase.from('item_images').upsert({ item_key: key, ...result }, { onConflict: 'item_key' }).then(
      () => {},
      () => {}
    )
  }
  return result
}
