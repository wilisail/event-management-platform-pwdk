import type { PrismaClient } from '../../generated/prisma/client'
import type { OrganizerStatisticsRange, OrganizerStatisticsTotals, OrganizerStatisticsView, StatisticsGroup } from '../../contracts/types'

const timeZone = 'Asia/Jakarta'
const jakartaDate = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
const dayMs = 86_400_000
const key = (date: Date) => date.toISOString().slice(0, 10)
const asDate = (value: string) => new Date(value + 'T00:00:00.000Z')
const monthIndex = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth()

export function statisticsRange(input: { groupBy: StatisticsGroup; from?: string; to?: string }, now: Date): OrganizerStatisticsRange | null {
  const { groupBy } = input
  if ((input.from === undefined) !== (input.to === undefined)) return null
  const parts = Object.fromEntries(jakartaDate.formatToParts(now).map(part => [part.type, part.value]))
  const today = `${parts.year}-${parts.month}-${parts.day}`
  if (input.from === undefined) {
    const start = asDate(today)
    if (groupBy === 'day') start.setUTCDate(start.getUTCDate() - 13)
    if (groupBy === 'month') { start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 11) }
    if (groupBy === 'year') start.setUTCFullYear(start.getUTCFullYear() - 4, 0, 1)
    return { groupBy, from: key(start), to: today }
  }
  const from = asDate(input.from), to = asDate(input.to!)
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || key(from) !== input.from || key(to) !== input.to ||
    input.from < '0001-01-01' || input.from > input.to! || input.to! > today) return null
  const exceedsLimit = groupBy === 'day' ? (+to - +from) / dayMs >= 93
    : groupBy === 'month' ? monthIndex(to) - monthIndex(from) >= 36
    : to.getUTCFullYear() - from.getUTCFullYear() >= 10
  return exceedsLimit ? null : { groupBy, from: input.from, to: input.to! }
}

const zero = (): OrganizerStatisticsTotals => ({ revenueIdr: 0, purchaseCount: 0, ticketQuantity: 0 })
function safeNumber(value: bigint) {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Statistics total outside safe JSON range')
  return Number(value)
}

export function prismaOrganizerStatistics(db: Pick<PrismaClient, '$queryRaw'>) {
  return async (organizerId: string, range: OrganizerStatisticsRange): Promise<OrganizerStatisticsView> => {
    const rows = await db.$queryRaw<{ startDate: string; revenue: string; purchases: string; tickets: string }[]>`
      SELECT to_char(date_trunc(${range.groupBy}::text, p.completed_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS "startDate",
        sum(p.total_price)::text AS revenue, count(*)::text AS purchases, sum(items.quantity)::text AS tickets
      FROM temuevent.purchases p
      JOIN temuevent.events e ON e.id = p.event_id AND e.organizer_id = ${organizerId}::uuid
      CROSS JOIN LATERAL (
        SELECT coalesce(sum(i.quantity), 0) AS quantity
        FROM temuevent.purchase_items i WHERE i.event_id = p.event_id AND i.purchase_id = p.id
      ) items
      WHERE p.status = 'DONE'
        AND p.completed_at >= (${range.from}::date::timestamp AT TIME ZONE 'Asia/Jakarta')
        AND p.completed_at < ((${range.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
      GROUP BY 1 ORDER BY 1`
    const byStart = new Map(rows.map(row => [row.startDate, row]))
    const cursor = asDate(range.from)
    if (range.groupBy === 'month') cursor.setUTCDate(1)
    if (range.groupBy === 'year') cursor.setUTCMonth(0, 1)
    const periods: OrganizerStatisticsView['periods'] = []
    let revenue = 0n, purchases = 0n, tickets = 0n
    while (key(cursor) <= range.to) {
      const startDate = key(cursor), row = byStart.get(startDate)
      if (row) {
        const amount = BigInt(row.revenue), count = BigInt(row.purchases), quantity = BigInt(row.tickets)
        revenue += amount; purchases += count; tickets += quantity
        periods.push({ startDate, revenueIdr: safeNumber(amount), purchaseCount: safeNumber(count), ticketQuantity: safeNumber(quantity) })
      } else periods.push({ startDate, ...zero() })
      if (range.groupBy === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1)
      else if (range.groupBy === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1)
    }
    return { ...range, timeZone, periods,
      totals: { revenueIdr: safeNumber(revenue), purchaseCount: safeNumber(purchases), ticketQuantity: safeNumber(tickets) },
    }
  }
}
