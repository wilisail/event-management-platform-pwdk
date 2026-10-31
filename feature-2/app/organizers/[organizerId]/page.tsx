import { OrganizerPreview } from '../../../components/organizer-preview'

export default async function Page({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params
  return <OrganizerPreview organizerId={organizerId} />
}
