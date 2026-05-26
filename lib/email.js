export async function sendReceiptEmail({ to, memberName, paidBy, storeName, receiptCode, total, isSelf, pdfBuffer }) {
  const title = storeName || `Receipt #${receiptCode}`
  const subject = isSelf
    ? `You paid — ${title}`
    : `Your share from ${title}`

  const amountLine = isSelf
    ? `You paid <strong>$${total.toFixed(2)}</strong> for this receipt.`
    : `You owe <strong>${paidBy}</strong> a total of <strong>$${total.toFixed(2)}</strong>.`

  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;background:#f5f3ff;padding:24px;border-radius:20px;">
      <div style="background:linear-gradient(135deg,#7c3aed,#8b5cf6);border-radius:16px;padding:24px 24px 20px;margin-bottom:20px;">
        <p style="color:rgba(255,255,255,0.75);font-size:11px;letter-spacing:4px;margin:0 0 8px;">SPLITS</p>
        <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 4px;">${title}</h1>
        <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">#${receiptCode} · Paid by ${paidBy}</p>
      </div>

      <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:16px;">
        <p style="color:#4c1d95;font-size:15px;font-weight:700;margin:0 0 4px;">Hi ${memberName} 👋</p>
        <p style="color:#555;font-size:14px;margin:0;">${amountLine}</p>
      </div>

      <p style="color:#888;font-size:12px;text-align:center;margin:16px 0 0;">
        Your full itemised receipt is attached as a PDF.
      </p>
    </div>
  `

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Splits', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      attachment: [
        {
          name: `splits-${receiptCode}.pdf`,
          content: Buffer.from(pdfBuffer).toString('base64'),
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo error ${res.status}: ${err}`)
  }
}
