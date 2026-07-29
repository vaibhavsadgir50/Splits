import { pickRelevantImageMatch } from './gemini'

// Free, key-less product image lookup, tried in order:
// 1. Open Food Facts — official public API, best for branded/packaged goods.
// 2. Openverse — official public API (openly-licensed photos, mostly Flickr),
//    good for specific/branded real-world products Wikipedia doesn't have a page for.
// 3. Wikipedia/Wikimedia — official public API, very reliable, generic-but-
//    real photos for common food/product names.
// 4. DuckDuckGo image search — undocumented endpoint, best-effort.
// 5. Bing image search — second undocumented fallback, independent of DDG.
//
// 4/5 are scraped, not official APIs, and get treated very differently on a
// serverless host than a residential dev machine: confirmed live against
// production (not assumed) that DuckDuckGo comes back without its usual
// security token (soft-blocked) and Bing returns unrelated generic content
// (e.g. meme images for a grocery query) rather than an outright error —
// both look "successful" but aren't. 1/2/3 are real APIs meant for exactly
// this kind of programmatic access and go first so most items still get a
// real, correct photo even with 4/5 effectively unusable in production.
//
// Every external request has a hard timeout so one stalling source can't
// eat the whole function's time budget.
//
// DuckDuckGo/Bing candidates are judged by Gemini (lib/gemini.js) rather
// than a word-overlap heuristic — a bare word match let an ambiguous word
// in a multi-word product name hijack the result (a "Zara" brand of paste
// matching the Zara clothing retailer). Gemini actually reads what each
// candidate is. The cruder word-overlap check remains as a fallback only
// if the Gemini call itself fails.

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

function log(trace, msg) {
  console.log(msg)
  trace?.push(msg)
}

function significantWords(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
}

// A SINGLE overlapping word isn't enough — a multi-word product name can
// contain one word that happens to collide with something far more famous
// (e.g. a "Zara" brand of ginger-garlic paste matching a search result
// about the Zara clothing retailer, with "ginger"/"garlic"/"paste" all
// ignored). Require at least 2 of the query's significant words to appear
// (or all of them, if the query only has 1) before calling it a match.
function isRelevantMatch(query, candidateText) {
  const queryWords = significantWords(query)
  if (!queryWords.length) return false
  const candidateWords = new Set(significantWords(candidateText))
  const matchCount = queryWords.filter((w) => candidateWords.has(w)).length
  const required = Math.min(2, queryWords.length)
  return matchCount >= required
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
async function searchOpenFoodFacts(query, trace) {
  try {
    let data = await fetchOpenFoodFactsOnce(query)
    if (!data) {
      await new Promise((r) => setTimeout(r, 400))
      data = await fetchOpenFoodFactsOnce(query)
    }
    if (!data) { log(trace, `[productImages] openfoodfacts: no response for "${query}"`); return null }
    for (const p of data.products || []) {
      const image = p.image_front_small_url || p.image_url
      if (!image) continue
      const candidateText = `${p.product_name || ''} ${p.brands || ''}`
      if (isRelevantMatch(query, candidateText)) {
        log(trace, `[productImages] openfoodfacts: matched "${p.product_name}"`)
        return { image_url: image, source: 'openfoodfacts' }
      }
    }
    log(trace, `[productImages] openfoodfacts: no relevant match for "${query}" (${data.products?.length ?? 0} candidates)`)
    return null
  } catch (err) {
    log(trace, `[productImages] openfoodfacts: error for "${query}" — ${err.name}: ${err.message}`)
    return null
  }
}

async function searchWikipedia(query, trace) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=400&redirects=1&origin=*`
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Splits-App/1.0' } })
    if (!res.ok) { log(trace, `[productImages] wikipedia: status ${res.status} for "${query}"`); return null }
    const data = await res.json()
    const pages = data?.query?.pages
    const page = pages ? Object.values(pages)[0] : null
    const image = page?.thumbnail?.source
    if (!image) { log(trace, `[productImages] wikipedia: no image for "${query}"`); return null }
    if (!isRelevantMatch(query, page.title || '')) {
      log(trace, `[productImages] wikipedia: "${page.title}" not relevant to "${query}"`)
      return null
    }
    log(trace, `[productImages] wikipedia: matched "${page.title}"`)
    return { image_url: image, source: 'wikipedia' }
  } catch (err) {
    log(trace, `[productImages] wikipedia: error for "${query}" — ${err.name}: ${err.message}`)
    return null
  }
}

async function searchOpenverse(query, trace) {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=5`
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Splits-App/1.0' } })
    if (!res.ok) { log(trace, `[productImages] openverse: status ${res.status} for "${query}"`); return null }
    const data = await res.json()
    for (const r of data.results ?? []) {
      if (r.url && isRelevantMatch(query, r.title || '')) {
        log(trace, `[productImages] openverse: matched "${r.title}"`)
        return { image_url: r.url, source: 'openverse' }
      }
    }
    log(trace, `[productImages] openverse: ${data.results?.length ?? 0} results for "${query}" but none matched`)
    return null
  } catch (err) {
    log(trace, `[productImages] openverse: error for "${query}" — ${err.name}: ${err.message}`)
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

async function searchDuckDuckGo(query, trace) {
  try {
    const homeRes = await fetchWithTimeout(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    log(trace, `[productImages] duckduckgo: homepage status ${homeRes.status}`)
    const html = await homeRes.text()
    const match = html.match(/vqd=["']([\d-]+)["']/) || html.match(/vqd=([\d-]+)&/)
    const vqd = match?.[1]
    if (!vqd) {
      log(trace, `[productImages] duckduckgo: no vqd token for "${query}" (likely blocked) — body starts: ${html.slice(0, 150).replace(/\s+/g, ' ')}`)
      return null
    }
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
    if (!imgRes.ok) { log(trace, `[productImages] duckduckgo: image endpoint status ${imgRes.status} for "${query}"`); return null }
    const data = await imgRes.json()
    const candidates = (data.results ?? []).slice(0, 5).filter((c) => c?.image)
    if (!candidates.length) { log(trace, `[productImages] duckduckgo: no results for "${query}"`); return null }

    try {
      const pick = await pickRelevantImageMatch(query, candidates)
      if (pick === -1) {
        log(trace, `[productImages] duckduckgo: Gemini found no genuine match among ${candidates.length} — titles: ${candidates.map((c) => c.title).join(' | ')}`)
        return null
      }
      log(trace, `[productImages] duckduckgo: Gemini matched "${candidates[pick].title}"`)
      return { image_url: candidates[pick].image, source: 'duckduckgo' }
    } catch (err) {
      // Gemini call itself failed (not "no match") — fall back to the
      // cruder word-overlap check rather than losing the result entirely.
      log(trace, `[productImages] duckduckgo: relevance judge failed (${err.message}), falling back to word-overlap`)
      const fallback = candidates.find((c) => isRelevantMatch(query, c.title || ''))
      if (fallback) return { image_url: fallback.image, source: 'duckduckgo' }
      return null
    }
  } catch (err) {
    log(trace, `[productImages] duckduckgo: error for "${query}" — ${err.name}: ${err.message}`)
    return null
  }
}

async function searchBingImages(query, trace) {
  try {
    const res = await fetchWithTimeout(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    log(trace, `[productImages] bing: status ${res.status}`)
    if (!res.ok) { log(trace, `[productImages] bing: status ${res.status} for "${query}"`); return null }
    const html = await res.text()
    const matches = [...html.matchAll(/class="iusc"[^>]*m="([^"]+)"/g)].slice(0, 5)
    if (!matches.length) {
      log(trace, `[productImages] bing: no results for "${query}" (likely blocked) — body length ${html.length}, starts: ${html.slice(0, 150).replace(/\s+/g, ' ')}`)
      return null
    }
    const candidates = []
    for (const m of matches) {
      try {
        const data = JSON.parse(m[1].replace(/&quot;/g, '"'))
        if (data.murl) {
          // Bing occasionally appends a stray "[N]" variant marker to murl
          // that isn't part of the real asset path — strip it if present.
          candidates.push({ title: data.t, desc: data.desc, image: data.murl.replace(/\[\d+\]$/, '') })
        }
      } catch {
        // skip unparseable candidate
      }
    }
    if (!candidates.length) { log(trace, `[productImages] bing: no parseable results for "${query}"`); return null }

    try {
      const pick = await pickRelevantImageMatch(query, candidates)
      if (pick === -1) {
        log(trace, `[productImages] bing: Gemini found no genuine match among ${candidates.length} — titles: ${candidates.map((c) => c.title).join(' | ')}`)
        return null
      }
      log(trace, `[productImages] bing: Gemini matched "${candidates[pick].title}"`)
      return { image_url: candidates[pick].image, source: 'bing' }
    } catch (err) {
      log(trace, `[productImages] bing: relevance judge failed (${err.message}), falling back to word-overlap`)
      const fallback = candidates.find((c) => isRelevantMatch(query, `${c.title || ''} ${c.desc || ''}`))
      if (fallback) return { image_url: fallback.image, source: 'bing' }
      return null
    }
  } catch (err) {
    log(trace, `[productImages] bing: error for "${query}" — ${err.name}: ${err.message}`)
    return null
  }
}

// Resolves {image_url, source} for a single item — never throws.
// `trace`, if given an array, gets a step-by-step log of what each source
// did — used by the ?debug=1 path on /api/item-image to see exactly what a
// production environment gets back, without needing dashboard log access.
export async function resolveItemImage(item, trace) {
  const rawQuery = (item.raw_name || item.name || '').trim()
  const cleanQuery = (item.name || rawQuery).trim()
  if (!rawQuery) return { image_url: null, source: 'none' }

  const offResult = await searchOpenFoodFacts(rawQuery, trace)
  if (offResult) return offResult

  const openverseResult = await searchOpenverse(cleanQuery, trace)
  if (openverseResult) return openverseResult

  const wikiResult = await searchWikipedia(cleanQuery, trace)
  if (wikiResult) return wikiResult

  const ddgResult = await searchDuckDuckGo(`${cleanQuery} product`, trace)
  if (ddgResult) return ddgResult

  const bingResult = await searchBingImages(`${cleanQuery} product`, trace)
  if (bingResult) return bingResult

  log(trace, `[productImages] no image found anywhere for "${cleanQuery}"`)
  return { image_url: null, source: 'none' }
}

// Same as resolveItemImage, but checks/writes a Supabase cache first so a
// repeat item (e.g. "Bananas" on next week's receipt) never gets re-queried.
export async function resolveItemImageCached(supabase, item, trace) {
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

  const result = await resolveItemImage(item, trace)
  if (result.image_url) {
    supabase.from('item_images').upsert({ item_key: key, ...result }, { onConflict: 'item_key' }).then(
      () => {},
      () => {}
    )
  }
  return result
}
