import { GoogleGenAI } from '@google/genai'
import { ITEM_CATEGORIES } from './itemCategories'

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
              'You are an expert at reading real-world grocery and delivery receipts — including ' +
              'Instacart, DoorDash, Uber Eats, and Target/Walmart-style receipts, which are often blurry, ' +
              'skewed, low-resolution screenshots with cramped columns and abbreviated names.\n\n' +
              'Extract the store name and every purchased item with its price and category.\n' +
              'Return a raw JSON object only — no markdown fences, no prose:\n' +
              '{"store": "Trader Joe\'s", "items": [{"name": "Whole Milk (1L)", "raw_name": "TJ WHL MLK 1L", "price": 3.99, "confidence": "high", "category": "dairy_eggs"}]}\n\n' +
              'Price-attribution rules (the most common mistake — read carefully):\n' +
              '- Each price belongs to the item name on the SAME line, or the nearest line if the name wraps onto two lines.\n' +
              '- NEVER use a SKU, UPC/barcode number, quantity code, or loyalty/item ID as a price — a real price is a currency amount, usually with 2 decimal places.\n' +
              '- Weight/quantity-priced items (e.g. "1.24 lb @ $2.99/lb") — extract the FINAL charged amount, not the per-unit rate.\n' +
              '- If a single item spans a wrapped/multi-line name, merge it into one item with one price — do not split it into two rows.\n' +
              '- If you are genuinely unsure which price belongs to which item (columns misaligned, ink faded, overlapping text), still make your best guess but mark that item low-confidence rather than guessing silently.\n\n' +
              'Other rules:\n' +
              '- store: the shop/store name from the receipt header; null if not visible\n' +
              '- Product line items only (exclude tax, subtotal, delivery fee, tip, and grand total rows)\n' +
              '- Discounts/coupons shown on their own line → include as a negative-price item\n' +
              '- raw_name: the exact text as printed on the receipt, abbreviations and all — do not clean this up\n' +
              '- name: a short, human-friendly product name a person would recognize at a glance (expand obvious abbreviations, ' +
              'add brand if legible, include size/quantity in parentheses if shown e.g. "Paneer (1kg)", "Doritos Nacho Cheese"). ' +
              'Receipts are often cryptic — this field is what the user will actually read, so make it genuinely clearer than raw_name, ' +
              'not just a copy of it.\n' +
              '- Prices must be numbers; use null only if truly unreadable\n' +
              '- confidence: "high" if both the name and price are clearly legible and unambiguous, "low" if either is blurry, guessed, misaligned, or you are not fully sure the price matches this exact item\n' +
              `- category: exactly one of ${JSON.stringify(ITEM_CATEGORIES)} — pick the closest match by product type, use "other" only if nothing fits\n` +
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
  const items = Array.isArray(parsed) ? parsed : (parsed.items ?? [])
  const normalized = items.map((i) => ({
    name: i.name || i.raw_name,
    raw_name: i.raw_name || i.name,
    price: i.price,
    confidence: i.price == null ? 'low' : (i.confidence === 'low' ? 'low' : 'high'),
    category: ITEM_CATEGORIES.includes(i.category) ? i.category : 'other',
  }))
  if (Array.isArray(parsed)) return { store: null, items: normalized }
  return { store: parsed.store ?? null, items: normalized }
}

export async function generateEmbedding(text) {
  const ai = getAI()
  const response = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: text,
  })
  return response.embeddings[0].values
}
