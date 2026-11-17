'use client'

import { use } from 'react'
import { SiteHeader } from '@/components/site-header'
import { TemporaryPurchase } from '@/feature-2/components/temporary-purchases'

export default function TransactionPage({ params }: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = use(params)
  return <><SiteHeader view="order" /><TemporaryPurchase key={transactionId} id={transactionId} /></>
}
