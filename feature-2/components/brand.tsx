import Link from 'next/link'

// Use the approved asset unchanged; see docs/branding/README.md on main.
export function Brand() {
  return (
    <Link href="/" className="brand">
      <img src="/temuevent-logo.svg" alt="TemuEvent" width={180} height={45} />
    </Link>
  )
}

