import { events, type Event } from '@/lib/events'

export type Organizer = { id: string; name: string; location: string; description: string; initials: string; badge: string }
export type OrganizerReview = { id: string; eventId: number; reviewer: string; initials: string; rating: number; text: string; date: string }

export const organizers: Organizer[] = [{ id: 'jakarta-coffee-collective', name: 'Jakarta Coffee Collective', location: 'Jakarta', description: 'Komunitas yang menghadirkan pengalaman kopi, workshop, dan pertemuan kreatif untuk para pencinta kopi.', initials: 'JC', badge: 'Penyelenggara' }]

export const organizerReviews: OrganizerReview[] = [
  { id: 'review-1', eventId: 1, reviewer: 'Nadia Putri', initials: 'NP', rating: 5, text: 'Kurasi roaster-nya keren dan suasananya hangat. Banyak hal baru yang saya pelajari soal kopi spesialti.', date: '12 Juni 2025' },
  { id: 'review-2', eventId: 1, reviewer: 'Raka Aditya', initials: 'RA', rating: 5, text: 'Acara tertata rapi, volunteer ramah, dan workshop-nya sangat praktis.', date: '9 Juni 2025' },
  { id: 'review-3', eventId: 1, reviewer: 'Maya Lestari', initials: 'ML', rating: 4, text: 'Pilihan tenant banyak dan venue nyaman. Akan datang lagi tahun depan.', date: '5 Juni 2025' },
  { id: 'review-4', eventId: 1, reviewer: 'Dimas Pratama', initials: 'DP', rating: 5, text: 'Pengalaman yang menyenangkan untuk pencinta kopi pemula maupun yang sudah lama ngopi.', date: '2 Juni 2025' },
]

export function getOrganizerEvents(organizer: Organizer): Event[] { return events.filter(event => event.organizer === organizer.name && event.seats >= 0) }
export function getOrganizer(id: string) { return organizers.find(organizer => organizer.id === id) }
