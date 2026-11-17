import type { EventSummaryView, AttendeePurchaseView, PageView } from '../../contracts/types'

export interface OrganizerReadRepository {
  listEvents(organizerId: string, page: number, pageSize: number): Promise<PageView<EventSummaryView>>
  eventBelongsTo(organizerId: string, eventId: string): Promise<boolean>
  listAttendees(organizerId: string, eventId: string, page: number, pageSize: number): Promise<PageView<AttendeePurchaseView>>
}
