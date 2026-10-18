export type Event = {
  id: number
  title: string
  category: string
  date: string
  dateLabel: string
  location: string
  venue: string
  address: string
  time: string
  price: number | null
  image: string
  rating?: string
  featured?: string
  organizer: string
  description: string
  seats: number
}

export const events: Event[] = [
  { id: 1, title: 'Jakarta Coffee Festival 2025', category: 'Food & Beverage', date: '2025-05-24', dateLabel: '24 Mei 2025', time: '09.00–20.00 WIB', location: 'Senayan Park, Jakarta', venue: 'Senayan Park', address: 'Jl. Gerbang Pemuda No. 3, Jakarta Pusat', price: 150000, rating: '4.9 (420+)', featured: 'Pilihan Editor', image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1400&q=90', organizer: 'Jakarta Coffee Collective', description: 'Festival kopi spesialti yang mempertemukan roaster lokal, barista, komunitas, dan para pencinta kopi dalam satu akhir pekan yang penuh rasa.', seats: 40 },
  { id: 2, title: 'Independent Music Night Vol. 4', category: 'Musik', date: '2025-06-14', dateLabel: '14 Jun 2025', time: '19.00–23.00 WIB', location: 'Spasial Soda, Bandung', venue: 'Spasial Soda', address: 'Jl. Gudang Selatan No. 22, Bandung', price: 85000, rating: '4.8 (50+)', featured: 'Hot Ticket', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=90', organizer: 'Ruang Suara', description: 'Malam musik independen dengan penampilan pilihan dari musisi baru dan komunitas kreatif Bandung.', seats: 18 },
  { id: 3, title: 'Jakarta Tech Meetup: Scalable Node.js & Supabase', category: 'Teknologi', date: '2025-05-30', dateLabel: '30 Mei 2025', time: '18.30–21.00 WIB', location: 'GoWork Pacific Place, Jakarta', venue: 'GoWork Pacific Place', address: 'Pacific Place Mall, Jakarta Selatan', price: null, rating: '4.9 (75+)', featured: 'Free RSVP', image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=90', organizer: 'IndoJS & Cloud', description: 'Sesi berbagi praktis tentang membangun aplikasi yang siap bertumbuh bersama developer dan cloud community.', seats: 60 },
  { id: 4, title: 'UI/UX Design System Workshop', category: 'Workshops', date: '2025-06-07', dateLabel: '7 Jun 2025', time: '10.00–16.00 WIB', location: 'Workshop With Figma, Jakarta', venue: 'Workshop With Figma', address: 'Jl. Kemang Raya, Jakarta Selatan', price: 50000, image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=90', organizer: 'Product Design ID', description: 'Workshop hands-on untuk memahami fondasi design system dan membuat produk digital yang konsisten.', seats: 0 },
]

export const formatPrice = (price: number | null) => price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price).replace('IDR', 'Rp') : 'Gratis'
