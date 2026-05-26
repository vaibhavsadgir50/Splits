import { NextResponse } from 'next/server'
import { generateReceiptPDF } from '@/lib/pdf'
import { sendReceiptEmail } from '@/lib/email'

export async function GET() {
  try {
    const items = [
      { name: 'Test Item', price: 10.00, splitWith: ['Prem'], share: 10.00 }
    ]
    const pdfBuffer = await generateReceiptPDF({
      memberName: 'Prem',
      paidBy: 'Prem',
      storeName: 'Test Store',
      receiptCode: 'TEST123',
      date: new Date().toISOString(),
      items,
      total: 10.00,
      isSelf: true,
    })
    await sendReceiptEmail({
      to: 'vc2651@nyu.edu',
      memberName: 'Prem',
      paidBy: 'Prem',
      storeName: 'Test Store',
      receiptCode: 'TEST123',
      total: 10.00,
      isSelf: true,
      pdfBuffer,
    })
    return NextResponse.json({ ok: true, message: 'Email sent — check your inbox' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
