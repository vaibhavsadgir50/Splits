# Splits — Household Grocery Ledger

Upload a receipt photo → Gemini reads every item → tick who shares what → totals saved to Supabase.  
Past purchases are embedded with `text-embedding-004` and used as RAG context for future receipts.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| AI Agent | Google Gemini `gemini-2.5-flash` via `@google/genai` |
| Embeddings | Gemini `text-embedding-004` (768-dim) |
| Vector store | Supabase pgvector |
| Database | Supabase Postgres |
| Deploy | Vercel |

---

## One-time Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql` and run it.  
   This creates the `members`, `receipts`, `items`, `item_embeddings` tables and the `match_items` pgvector function.
3. Copy your project URL and keys from **Project Settings → API**.

### 2. Gemini API key

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:
```
GEMINI_API_KEY=AIza...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Running locally

```bash
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Deploy to Vercel

```bash
npx vercel
```

Add the four env vars in **Vercel → Project → Settings → Environment Variables**.

---

## Usage flow

1. **Members** → add everyone in the household (stored in Supabase).
2. **Upload Receipt** → pick who you are, drop a receipt photo.  
   Gemini receives the image plus a RAG context block of your 25 most recently purchased items, which improves OCR accuracy for recurring products.
3. **Review & Split** → editable item table.  
   - Column header buttons toggle all items for that person.  
   - "All" checkbox per row toggles all members for that item.  
   - Per-person running totals update live at the bottom.
4. **Calculate & Save** → shares written to Supabase.  
   Each item's name is embedded with `text-embedding-004` and stored in `item_embeddings` (fire-and-forget, doesn't block the response).
5. **History → Search** → type any phrase (e.g. "dairy", "cleaning products") and the RAG semantic search runs a pgvector cosine similarity query to find matching past items, showing the match percentage.

---

## RAG architecture

```
New receipt uploaded
       │
       ▼
Recent items fetched from Supabase ──► formatted as context string
       │
       ▼
Gemini (gemini-2.5-flash) + image + context ──► parsed item list
       │
       ▼
Items saved to Supabase
       │
       ▼  (async, fire-and-forget)
text-embedding-004 generates 768-dim vector per item name
       │
       ▼
Vectors stored in item_embeddings (pgvector)
       │
       ▼  (on History → Search)
Query embedded ──► match_items() cosine similarity ──► results shown
```
