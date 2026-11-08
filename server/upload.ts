
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'

const allowedTypes: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, tmpdir())
  },
  filename: (_req, file, callback) => {
    const extension = allowedTypes[file.mimetype]

    callback(null, `${randomUUID()}${extension}`)
  },
})

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 1,
    fieldSize: 64 * 1024,
    parts: 3,
  },
  fileFilter: (_req, file, callback) => {
    if (allowedTypes[file.mimetype]) {
      callback(null, true)
    } else {
      callback(new Error('Only JPEG, PNG, and WebP images are allowed.'))
    }
  },
})
