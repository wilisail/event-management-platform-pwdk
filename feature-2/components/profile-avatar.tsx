'use client'

import { useState } from 'react'

export function ProfileAvatar({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState<string | null>(null)
  return <div className="avatar" aria-hidden="true">{url && failed !== url
    ? <img src={url} alt="" width={72} height={72} onError={() => setFailed(url)} />
    : name.trim().slice(0, 1).toUpperCase()}</div>
}
