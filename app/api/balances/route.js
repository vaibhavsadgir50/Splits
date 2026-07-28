import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request) {
  const ledgerId = new URL(request.url).searchParams.get('ledger_id')
  if (!ledgerId) return NextResponse.json({ error: 'ledger_id is required' }, { status: 400 })

  const supabase = getSupabase()

  // Fetch receipts and settlements in parallel
  const [{ data: receipts, error: rErr }, { data: settlementsData, error: sErr }] =
    await Promise.all([
      supabase.from('receipts').select('paid_by, items(split_with, per_person_amt)').eq('ledger_id', ledgerId),
      supabase.from('settlements').select('paid_by, paid_to, amount').eq('ledger_id', ledgerId),
    ])

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  // rawDebt[from][to] = total amount 'from' owes 'to'
  const rawDebt = {}

  // 1. Debts from receipts
  for (const receipt of receipts ?? []) {
    const payer = receipt.paid_by
    for (const item of receipt.items ?? []) {
      const perPerson = parseFloat(item.per_person_amt) || 0
      for (const person of item.split_with ?? []) {
        if (person === payer) continue
        if (!rawDebt[person]) rawDebt[person] = {}
        rawDebt[person][payer] = (rawDebt[person][payer] ?? 0) + perPerson
      }
    }
  }

  // 2. Settlements reduce debt: if Bob paid Alice $10,
  //    treat it as Alice now "owes" Bob $10 back — netting against Bob's debt to Alice.
  for (const s of settlementsData ?? []) {
    const amount = parseFloat(s.amount) || 0
    if (!rawDebt[s.paid_to]) rawDebt[s.paid_to] = {}
    rawDebt[s.paid_to][s.paid_by] = (rawDebt[s.paid_to][s.paid_by] ?? 0) + amount
  }

  // Collect all people involved
  const people = new Set()
  for (const [from, tos] of Object.entries(rawDebt)) {
    people.add(from)
    for (const to of Object.keys(tos)) people.add(to)
  }

  // Net out pairwise → simplified settlement list
  const settlements = []
  const netBalances = {}
  const peopleArr = [...people]

  for (let i = 0; i < peopleArr.length; i++) {
    for (let j = i + 1; j < peopleArr.length; j++) {
      const A = peopleArr[i]
      const B = peopleArr[j]
      const AowesB = rawDebt[A]?.[B] ?? 0
      const BowesA = rawDebt[B]?.[A] ?? 0
      const net = Math.round((AowesB - BowesA) * 100) / 100

      if (net > 0.01) {
        settlements.push({ from: A, to: B, amount: net })
        netBalances[A] = (netBalances[A] ?? 0) - net
        netBalances[B] = (netBalances[B] ?? 0) + net
      } else if (net < -0.01) {
        settlements.push({ from: B, to: A, amount: Math.abs(net) })
        netBalances[B] = (netBalances[B] ?? 0) - Math.abs(net)
        netBalances[A] = (netBalances[A] ?? 0) + Math.abs(net)
      }
    }
  }

  for (const k of Object.keys(netBalances)) {
    netBalances[k] = Math.round(netBalances[k] * 100) / 100
  }

  return NextResponse.json({ settlements, netBalances })
}
