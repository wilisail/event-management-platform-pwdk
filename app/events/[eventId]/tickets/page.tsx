'use client'

import { use } from 'react'
import { SiteHeader } from '@/components/site-header'
import { TemporaryCheckout } from '@/feature-2/components/temporary-checkout'

export default function TicketPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  return <><SiteHeader view="checkout" /><TemporaryCheckout key={eventId} eventId={eventId} /></>
}
