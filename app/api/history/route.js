import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/gemini'

export const maxDuration = 30

// GET /api/history — paginated receipts with their items
export async function GET(request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

  const { data: receipts, error } = await supabase
    .from('receipts')
    .select(`
      id,
      receipt_code,
      store_name,
      paid_by,
      notes,
      created_at,
      items ( id, name, price, split_with, per_person_amt )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(receipts)
}

// DELETE /api/history?id=<receipt-uuid>
export async function DELETE(request) {
  const supabase = getSupabase()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('receipts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST /api/history — RAG semantic search via pgvector
export async function POST(request) {
  const supabase = getSupabase()
  const { query } = await request.json()
  if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

  try {
    const embedding = await generateEmbedding(query)
    const { data, error } = await supabase.rpc('match_items', {
      query_embedding: embedding,
      match_count: 10,
      min_similarity: 0.6,
    })
    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
