import { OrganizerProfile } from '../../../components/organizer-profile'

export default async function Page({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params
  return <OrganizerProfile organizerId={organizerId} />
}
