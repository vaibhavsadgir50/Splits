-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- If you already ran an older version of this file, see the migration notes at the bottom.

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Ledgers — a shared household/group ledger. A user's Google-authenticated
--    identity is NOT modeled here (Supabase Auth owns that); this table is
--    purely the shared ledger a member belongs to. The app's UI calls this
--    concept "Accounts" for simple end-user language, but internally it's a
--    ledger, distinct from the auth user.
CREATE TABLE IF NOT EXISTS ledgers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'My Household',
  invite_code TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Members — one row per (ledger, person). The same email can have a
--    member row in multiple ledgers (a person can belong to several
--    households), each potentially under a different display name.
CREATE TABLE IF NOT EXISTS members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id   UUID REFERENCES ledgers(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT members_ledger_name_unique UNIQUE (ledger_id, name)
);

-- 4. Receipts  (paid_by = person who fronted the money)
CREATE TABLE IF NOT EXISTS receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id    UUID REFERENCES ledgers(id) ON DELETE CASCADE NOT NULL,
  receipt_code TEXT UNIQUE NOT NULL,
  store_name   TEXT DEFAULT '',
  paid_by      TEXT NOT NULL,
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Line items
CREATE TABLE IF NOT EXISTS items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id      UUID REFERENCES ledgers(id) ON DELETE CASCADE NOT NULL,
  receipt_id     UUID REFERENCES receipts(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  price          NUMERIC(10, 2) NOT NULL,
  split_with     TEXT[]         NOT NULL DEFAULT '{}',
  per_person_amt NUMERIC(10, 2),
  category       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Item embeddings (768-dim — text-embedding-004)
CREATE TABLE IF NOT EXISTS item_embeddings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id    UUID REFERENCES ledgers(id) ON DELETE CASCADE,
  item_id      UUID REFERENCES items(id) ON DELETE CASCADE,
  item_name    TEXT NOT NULL,
  price        NUMERIC(10, 2),
  receipt_code TEXT,
  embedding    vector(768),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 7. IVFFlat index for cosine similarity search
CREATE INDEX IF NOT EXISTS item_embeddings_embedding_idx
  ON item_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- 8. Similarity search function, scoped to one ledger
CREATE OR REPLACE FUNCTION match_items(
  query_embedding  vector(768),
  match_count      INT   DEFAULT 8,
  min_similarity   FLOAT DEFAULT 0.65,
  filter_ledger_id UUID  DEFAULT NULL
)
RETURNS TABLE (
  item_name    TEXT,
  price        NUMERIC,
  receipt_code TEXT,
  purchased_at TIMESTAMPTZ,
  similarity   FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ie.item_name,
    ie.price,
    ie.receipt_code,
    ie.created_at AS purchased_at,
    (1 - (ie.embedding <=> query_embedding))::FLOAT AS similarity
  FROM item_embeddings ie
  WHERE (1 - (ie.embedding <=> query_embedding)) > min_similarity
    AND (filter_ledger_id IS NULL OR ie.ledger_id = filter_ledger_id)
  ORDER BY ie.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- 9. Settlements (cash payments between members to clear debts)
CREATE TABLE IF NOT EXISTS settlements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id  UUID REFERENCES ledgers(id) ON DELETE CASCADE NOT NULL,
  paid_by    TEXT NOT NULL,
  paid_to    TEXT NOT NULL,
  amount     NUMERIC(10, 2) NOT NULL,
  note       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Item image cache (Open Food Facts / DuckDuckGo lookups, keyed by
--     normalized item name). Global, not ledger-scoped — a product photo
--     isn't specific to any one household.
CREATE TABLE IF NOT EXISTS item_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key   TEXT UNIQUE NOT NULL,
  image_url  TEXT,
  source     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Migration notes ─────────────────────────────────────────────────────────
-- This file reflects the current multi-ledger schema. If your database
-- predates it (a single global household with no ledgers table), you migrated
-- via a one-off script, not by re-running this file — see project history.
