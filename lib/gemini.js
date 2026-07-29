import { GoogleGenAI } from '@google/genai'
import { ITEM_CATEGORIES } from './itemCategories'

let _ai = null
function getAI() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return _ai
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(err) {
  // The SDK's error message is often the raw API error JSON, e.g.
  // {"error":{"code":503,"message":"...","status":"UNAVAILABLE"}}
  let parsed = null
  if (typeof err?.message === 'string' && err.message.trim().startsWith('{')) {
    try { parsed = JSON.parse(err.message) } catch { /* not JSON */ }
  }
  const code = parsed?.error?.code ?? err?.status ?? err?.code
  const status = parsed?.error?.status ?? err?.statusText
  if (code === 503 || code === 429 || status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') return true
  const text = parsed?.error?.message || err?.message || ''
  return /overloaded|high demand|unavailable|resource.?exhausted|rate.?limit/i.test(text)
}

// Receipt parsing is simple structured extraction (read the text, fill a
// schema) — it doesn't need a flagship model, and the lighter models carry
// much higher rate limits, so they're tried first. A 503 (model overloaded)
// or 429 (rate limited) on one model falls through to the next rather than
// failing the whole receipt upload.
const FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash']
const MAX_RETRIES_PER_MODEL = 2
const RETRY_BASE_DELAY_MS = 700

export async function generateContentWithFallback(request) {
  let lastErr
  for (const model of FALLBACK_MODELS) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        return await getAI().models.generateContent({ ...request, model })
      } catch (err) {
        lastErr = err
        if (!isRetryableError(err)) throw err
        if (attempt < MAX_RETRIES_PER_MODEL) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
        }
      }
    }
    // Exhausted retries on this model — try the next one in the list
  }
  throw lastErr
}

// Defensive backstop for the prompt's "exclude non-product lines" rule —
// Gemini doesn't always follow it on messier receipts (Instacart-style order
// summaries in particular), so a payment/summary line can slip through as
// a fake "item". Short ambiguous words only match on an EXACT name (a real
// product is never named just "Total" or "Tip"); longer, distinctive
// phrases match as substrings since they can't collide with a real product name.
const EXACT_NON_PRODUCT_NAMES = new Set([
  'tip', 'total', 'tax', 'fee', 'deposit', 'charge', 'subtotal', 'balance',
  'savings', 'discount', 'change', 'gratuity',
])
const NON_PRODUCT_SUBSTRINGS = [
  'subtotal', 'sales tax', 'delivery fee', 'service fee', 'register fee',
  'registration fee', 'bank deposit', 'card was charged', 'card charged',
  'coupon savings', 'total savings', 'grand total', 'order total',
  'balance due', 'original charge',
]

function looksLikeNonProductLine(item) {
  const name = (item.name || '').trim().toLowerCase()
  const rawName = (item.raw_name || '').trim().toLowerCase()
  if (EXACT_NON_PRODUCT_NAMES.has(name) || EXACT_NON_PRODUCT_NAMES.has(rawName)) return true
  return NON_PRODUCT_SUBSTRINGS.some((s) => name.includes(s) || rawName.includes(s))
}

export async function parseReceiptImage(base64Data, mimeType, ragContext = '') {
  const contextNote = ragContext
    ? `\n\nContext — items this household has previously purchased (use to improve recognition of recurring items):\n${ragContext}`
    : ''

  const response = await generateContentWithFallback({
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
              '- Product line items ONLY. Exclude every non-product line, including but not limited to: ' +
              'tax, subtotal, item subtotal, delivery/service/register fees, tip, total, grand total, ' +
              'balance due, coupon/promo savings, discounts shown as their own summary line, bank/card ' +
              'deposit or charge confirmations (e.g. "your card was charged for $X"), order/confirmation ' +
              'numbers, and loyalty point summaries. If a line is a payment or summary figure rather than ' +
              'something the customer put in their cart, it is NEVER an item, no matter how it is labeled.\n' +
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
  const normalized = items
    .map((i) => ({
      name: i.name || i.raw_name,
      raw_name: i.raw_name || i.name,
      price: i.price,
      confidence: i.price == null ? 'low' : (i.confidence === 'low' ? 'low' : 'high'),
      category: ITEM_CATEGORIES.includes(i.category) ? i.category : 'other',
    }))
    .filter((i) => !looksLikeNonProductLine(i))
  if (Array.isArray(parsed)) return { store: null, items: normalized }
  return { store: parsed.store ?? null, items: normalized }
}

export async function generateEmbedding(text) {
  let lastErr
  for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
    try {
      const response = await getAI().models.embedContent({
        model: 'text-embedding-004',
        contents: text,
      })
      return response.embeddings[0].values
    } catch (err) {
      lastErr = err
      if (!isRetryableError(err)) throw err
      if (attempt < MAX_RETRIES_PER_MODEL) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
      }
    }
  }
  throw lastErr
}
