import type {
  AttendanceView, AttendeePurchaseView, EventSummaryView, OrganizerStatisticsRange, OrganizerStatisticsView,
  OrganizerTransactionDetail, OrganizerTransactionView, PageView, PurchaseStatus,
} from '../../contracts/types'
import type { OrganizerDecisionState } from './decision'

export interface OrganizerReadRepository {
  listEvents(organizerId: string, page: number, pageSize: number): Promise<PageView<EventSummaryView>>
  eventBelongsTo(organizerId: string, eventId: string): Promise<boolean>
  listAttendees(organizerId: string, eventId: string, page: number, pageSize: number): Promise<PageView<AttendeePurchaseView>>
  markAttendance?(organizerId: string, eventId: string, customerId: string, transactionId: string): Promise<AttendanceView | null>
  statistics?(organizerId: string, range: OrganizerStatisticsRange): Promise<OrganizerStatisticsView>
  transactions?: {
    list(organizerId: string, query: { page: number; pageSize: number; status?: PurchaseStatus }): Promise<PageView<OrganizerTransactionView>>
    detail(organizerId: string, transactionId: string): Promise<Omit<OrganizerTransactionDetail, 'decisionAvailability'> | null>
    decisionState(organizerId: string, transactionId: string): Promise<OrganizerDecisionState | null>
  }
}
