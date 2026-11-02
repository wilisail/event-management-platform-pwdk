import sharp from 'sharp'
import { MAX_STORED_PICTURE_BYTES, ProfileError, type PictureNormalizer } from './service'

let active = 0
/** Decode pixels, reject disguised/animated/oversize images, then discard metadata on re-encode. */
export const normalizePicture: PictureNormalizer = async (bytes, contentType) => {
  if (active >= 2) throw new ProfileError(503, 'PICTURE_BUSY', 'Photo processing is busy. Try again shortly')
  active++
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'warning' })
    const meta = await image.metadata()
    const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[meta.format as string]
    if (mime !== contentType || !meta.width || !meta.height || (meta.pages ?? 1) !== 1 ||
      meta.width * meta.height > 16_000_000) throw new Error('Unsupported image')
    const output = await image.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).timeout({ seconds: 5 }).toBuffer()
    if (output.length > MAX_STORED_PICTURE_BYTES) throw new Error('Image exceeds normalized limit')
    return output
  } catch { throw new ProfileError(400, 'INVALID_PICTURE', 'Choose a valid, still JPEG, PNG or WebP image up to 16 megapixels') }
  finally { active-- }
}
