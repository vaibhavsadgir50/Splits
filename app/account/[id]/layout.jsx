import AccountShell from '@/components/AccountShell'

export default async function AccountLayout({ children, modal, params }) {
  const { id } = await params
  return (
    <AccountShell ledgerId={id} modal={modal}>
      {children}
    </AccountShell>
  )
}
