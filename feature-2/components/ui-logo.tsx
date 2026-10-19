import Link from 'next/link'

// Original logo from Rizky's feature 1 push; see docs/ui/README.md on main.
export function UiLogo() {
  return (
    <Link href="/" className="ui-logo">
      <img src="/temuevent-logo.png" alt="TemuEvent" width={140} height={28} />
    </Link>
  )
}

