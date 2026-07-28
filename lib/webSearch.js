// Multi-source web search — no API keys, no single-provider rate limit.
// Each engine is scraped independently; if one is down or blocks us, the
// others still return results. This is the "many engines in parallel"
// resilience strategy SearXNG uses, built natively so it runs anywhere
// Node runs (including a Vercel serverless function later).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function decodeEntities(str) {
  return (str || '')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#0183;|&middot;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripTags(str) {
  return decodeEntities((str || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

function normalizeUrl(url) {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return url
  }
}

// ── DuckDuckGo HTML (html.duckduckgo.com) ───────────────────────────────
// Real target URL is URL-encoded in the `uddg` query param of a redirect link.
async function searchDuckDuckGo(query, limit = 8) {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) return []
  const html = await res.text()

  const results = []
  const blockRe = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>(.*?)<\/a>/g
  let match
  while ((match = blockRe.exec(html)) && results.length < limit) {
    const [, hrefRaw, titleRaw, snippetRaw] = match
    const uddgMatch = decodeEntities(hrefRaw).match(/uddg=([^&]+)/)
    if (!uddgMatch) continue
    const url = decodeURIComponent(uddgMatch[1])
    results.push({ title: stripTags(titleRaw), url, snippet: stripTags(snippetRaw), source: 'duckduckgo' })
  }
  return results
}

// ── Bing (www.bing.com) ──────────────────────────────────────────────────
// Real target URL is base64-encoded (prefixed "a1") in the `u` query param
// of a bing.com/ck/a redirect link.
async function searchBing(query, limit = 8) {
  const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) return []
  const html = await res.text()

  const results = []
  const blocks = html.split('class="b_algo"').slice(1)
  for (const block of blocks) {
    if (results.length >= limit) break
    const titleMatch = block.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a><\/h2>/)
    if (!titleMatch) continue
    const [, hrefRaw, titleRaw] = titleMatch
    const uMatch = decodeEntities(hrefRaw).match(/[?&]u=a1([^&]+)/)
    if (!uMatch) continue
    let url
    try {
      const b64 = uMatch[1] + '='.repeat((4 - (uMatch[1].length % 4)) % 4)
      url = Buffer.from(b64, 'base64').toString('utf-8')
    } catch {
      continue
    }
    const captionMatch = block.match(/<div class="b_caption">[\s\S]*?<p[^>]*>(.*?)<\/p>/)
    const snippet = captionMatch ? stripTags(captionMatch[1].replace(/<span class="news_dt">.*?<\/span>/, '')) : ''
    results.push({ title: stripTags(titleRaw), url, snippet, source: 'bing' })
  }
  return results
}

// ── Mojeek (www.mojeek.com) ──────────────────────────────────────────────
// The only one of the three that gives direct, unwrapped real URLs.
async function searchMojeek(query, limit = 8) {
  const res = await fetch(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) return []
  const html = await res.text()

  const results = []
  const blockRe = /<h2><a class="title" title="[^"]*" href="([^"]+)">(.*?)<\/a><\/h2><p class="s">(.*?)<\/p>/g
  let match
  while ((match = blockRe.exec(html)) && results.length < limit) {
    const [, url, titleRaw, snippetRaw] = match
    results.push({ title: stripTags(titleRaw), url, snippet: stripTags(snippetRaw), source: 'mojeek' })
  }
  return results
}

// Queries all engines in parallel; a failure/block on one doesn't affect
// the others. Merges + de-dupes by normalized URL (same page via different
// engines keeps whichever snippet was found first).
export async function webSearch(query, { limit = 8 } = {}) {
  const settled = await Promise.allSettled([
    searchDuckDuckGo(query, limit),
    searchBing(query, limit),
    searchMojeek(query, limit),
  ])

  const bySource = {}
  const engineNames = ['duckduckgo', 'bing', 'mojeek']
  settled.forEach((s, i) => {
    bySource[engineNames[i]] = s.status === 'fulfilled' ? s.value : []
  })

  const seen = new Set()
  const merged = []
  for (const list of Object.values(bySource)) {
    for (const r of list) {
      const key = normalizeUrl(r.url)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(r)
    }
  }

  return {
    results: merged,
    engineStatus: Object.fromEntries(engineNames.map((name, i) => [
      name,
      settled[i].status === 'fulfilled' ? `ok (${settled[i].value.length})` : `failed: ${settled[i].reason?.message ?? 'unknown'}`,
    ])),
  }
}
