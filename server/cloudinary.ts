
import { v2 as cloudinary } from 'cloudinary'

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    'Cloudinary configuration is incomplete. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
  )
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
})

type UploadedImage = {
  path: string
}

export async function uploadImage(file: UploadedImage) {
  return cloudinary.uploader.upload(file.path, {
    folder: 'temuevent/events',
    resource_type: 'image',
  })
}

export default cloudinary
