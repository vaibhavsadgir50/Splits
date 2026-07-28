import './globals.css'

export const metadata = {
  title: 'Splits — Household Grocery Ledger',
  description: 'Upload a receipt, split costs fairly, track everything.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="prism-bg font-body-base">{children}</body>
    </html>
  )
}
