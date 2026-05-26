import { GoogleGenAI } from '@google/genai'

let _ai = null
function getAI() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return _ai
}

export async function parseReceiptImage(base64Data, mimeType, ragContext = '') {
  const ai = getAI()
  const contextNote = ragContext
    ? `\n\nContext — items this household has previously purchased (use to improve recognition of recurring items):\n${ragContext}`
    : ''

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          {
            text:
              'Analyze this receipt and extract the store name and every purchased item with its price.\n' +
              'Return a raw JSON object only — no markdown fences, no prose:\n' +
              '{"store": "Trader Joe\'s", "items": [{"name": "Milk 1L", "price": 3.99}]}\n\n' +
              'Rules:\n' +
              '- store: the shop/store name from the receipt header; null if not visible\n' +
              '- Product line items only (exclude tax, subtotal, grand total rows)\n' +
              '- Discounts shown on their own line → include as negative price item\n' +
              '- Use the exact names shown on the receipt\n' +
              '- Prices must be numbers; use null if unreadable\n' +
              '- Return ONLY the raw JSON object' +
              contextNote,
          },
        ],
      },
    ],
  })

  let raw = response.text.trim()
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }
  const parsed = JSON.parse(raw)
  if (Array.isArray(parsed)) return { store: null, items: parsed }
  return { store: parsed.store ?? null, items: parsed.items ?? [] }
}

export async function generateEmbedding(text) {
  const ai = getAI()
  const response = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: text,
  })
  return response.embeddings[0].values
}
