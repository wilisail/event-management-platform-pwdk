'use client'

import { useEffect } from 'react'
import type { Role } from '../contracts/types'

export function useRolePageTitle(page: string, role?: Role) {
  useEffect(() => {
    const area = role === 'ORGANIZER' ? 'Organizer' : role === 'CUSTOMER' ? 'Customer' : ''
    document.title = `${area ? area + ' · ' : ''}${page} | TemuEvent`
  }, [page, role])
}
