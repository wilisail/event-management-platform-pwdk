
import { v2 as cloudinary } from 'cloudinary'
import { randomUUID } from 'node:crypto'

// Public event reads and account routes can start without the optional poster provider.
function configuredCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Event poster storage is not configured')
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
  return cloudinary
}

type UploadedImage = {
  path: string
}

export async function uploadImage(file: UploadedImage, organizerId: string) {
  return configuredCloudinary().uploader.upload(file.path, {
    folder: `temuevent/events/${organizerId}`,
    public_id: randomUUID(),
    resource_type: 'image',
  })
}

export async function removeImage(publicId: string) {
  return configuredCloudinary().uploader.destroy(publicId, { resource_type: 'image', invalidate: true })
}

export default cloudinary
