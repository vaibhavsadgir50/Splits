import { generateContentWithFallback } from './gemini'

// Scraped search results are noisy — an engine can occasionally answer a
// query with something off-topic (e.g. Bing serving a dictionary "best"
// definition for a query that happens to contain the word "best"). This is
// the "custom ranking" layer: Gemini reads the real scraped candidates and
// judges which ones actually answer the query, dropping junk and ordering
// the rest by relevance. It never invents links — it only ever reorders/
// filters links that were actually scraped.
export async function rankSearchResults(query, candidates) {
  if (!candidates.length) return []

  const listText = candidates
    .map((c, i) => `[${i}] ${c.title}\n${c.snippet}\n(${c.url})`)
    .join('\n\n')

  const response = await generateContentWithFallback({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              `Search query: "${query}"\n\nCandidate results (scraped from real search engines):\n${listText}\n\n` +
              'Return a raw JSON array only (no markdown fences, no prose) of the candidate indices that ' +
              'genuinely answer this query, ordered from most to least relevant. Drop anything off-topic, ' +
              'spammy, or clearly irrelevant (e.g. a dictionary definition of a word in the query, an unrelated ' +
              'retailer, a duplicate). Format: [2, 0, 4]',
          },
        ],
      },
    ],
  })

  let raw = response.text.trim()
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }

  let order
  try {
    order = JSON.parse(raw)
  } catch {
    return candidates
  }
  if (!Array.isArray(order)) return candidates

  return order
    .filter((i) => Number.isInteger(i) && candidates[i])
    .map((i) => candidates[i])
}
