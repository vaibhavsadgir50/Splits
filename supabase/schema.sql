-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- If you already ran the previous version, execute the ALTER at the bottom first.

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Members
CREATE TABLE IF NOT EXISTS members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Receipts  (paid_by = person who fronted the money)
CREATE TABLE IF NOT EXISTS receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code TEXT UNIQUE NOT NULL,
  paid_by      TEXT NOT NULL,
  notes        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Line items
CREATE TABLE IF NOT EXISTS items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id     UUID REFERENCES receipts(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  price          NUMERIC(10, 2) NOT NULL,
  split_with     TEXT[]         NOT NULL DEFAULT '{}',
  per_person_amt NUMERIC(10, 2),
  category       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Item embeddings (768-dim — text-embedding-004)
CREATE TABLE IF NOT EXISTS item_embeddings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID REFERENCES items(id) ON DELETE CASCADE,
  item_name    TEXT NOT NULL,
  price        NUMERIC(10, 2),
  receipt_code TEXT,
  embedding    vector(768),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 6. IVFFlat index for cosine similarity search
CREATE INDEX IF NOT EXISTS item_embeddings_embedding_idx
  ON item_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- 7. Similarity search function
CREATE OR REPLACE FUNCTION match_items(
  query_embedding vector(768),
  match_count     INT   DEFAULT 8,
  min_similarity  FLOAT DEFAULT 0.65
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
  ORDER BY ie.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- 8. Settlements (cash payments between members to clear debts)
CREATE TABLE IF NOT EXISTS settlements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_by    TEXT NOT NULL,
  paid_to    TEXT NOT NULL,
  amount     NUMERIC(10, 2) NOT NULL,
  note       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Item image cache (Open Food Facts / DuckDuckGo lookups, keyed by
--    normalized item name, so a repeat item never gets re-searched)
CREATE TABLE IF NOT EXISTS item_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key   TEXT UNIQUE NOT NULL,
  image_url  TEXT,
  source     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Household settings (single row — this app supports one household)
CREATE TABLE IF NOT EXISTS household_settings (
  id           INT PRIMARY KEY DEFAULT 1,
  account_name TEXT DEFAULT 'Our Household',
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT household_settings_single_row CHECK (id = 1)
);
INSERT INTO household_settings (id, account_name) VALUES (1, 'Our Household') ON CONFLICT (id) DO NOTHING;

-- ── Migrations: run these if you already ran the old schema ────────────────
-- ALTER TABLE receipts RENAME COLUMN uploaded_by TO paid_by;
-- (settlements table is new — just re-run the CREATE TABLE above)
-- ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
-- (item_images table is new — just re-run the CREATE TABLE above)
-- ALTER TABLE items ADD COLUMN IF NOT EXISTS category TEXT;
-- (household_settings table is new — just re-run the CREATE TABLE + INSERT above)
