import 'dotenv/config'
import { resolve } from 'node:path'
import { createRuntime } from '../feature-2/server/runtime'
import { createApp } from './app'
import * as events from './database'
import { uploadImage, removeImage } from './cloudinary'

export async function createIntegratedRuntime(options: { defer?: (work: Promise<unknown>) => void } = {}) {
  // Use the shared runtime connection, never the developer/shadow migration environment.
  process.env.DATABASE_CA_CERT_PATH ||= resolve('database/certs/prod-ca-2021.crt')
  const allowedOrigins = (process.env.F2_ALLOWED_ORIGINS || 'http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001').split(',').map(value => value.trim()).filter(Boolean)
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) allowedOrigins.push('https://' + process.env.VERCEL_URL)
  const accounts = await createRuntime({ fallthrough: true, allowedOrigins, defer: options.defer })
  const app = createApp({
    accountApi: accounts.app, sessionService: accounts.sessionService, allowedOrigins,
    eventsReader: events.readPublishedEvents, eventReader: events.readPublishedEventById,
    organizerReader: events.readOrganizerProfile, reviewReader: events.readEventReviews,
    eventCreator: events.createEvent, imageUploader: uploadImage,
    imageRemover: removeImage, imageInUse: events.imagePublicIdInUse,
    // Review writes remain closed until their frontend and attendance adapter are connected.
  })
  return { app, disconnect: async () => { await Promise.allSettled([accounts.disconnect?.(), events.disconnectDatabase()]) } }
}
