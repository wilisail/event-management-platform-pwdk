import Link from 'next/link'

// Direct export of Rizky's original header; see docs/branding/README.md on main.
export function Brand() {
  return (
    <Link href="/" className="brand">
      <img src="/temuevent-logo.png" alt="TemuEvent" width={140} height={28} />
    </Link>
  )
}

