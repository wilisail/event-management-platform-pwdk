import { isIP } from 'node:net'
import { resolve } from 'node:path'
import { waitUntil } from '@vercel/functions'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createRuntime } from '../../server/runtime'

const onVercel = process.env.VERCEL === '1'
let runtime: ReturnType<typeof createRuntime> | undefined

function hostedRuntime() {
  if (onVercel) process.env.DATABASE_CA_CERT_PATH ||= resolve(process.cwd(), 'certs/prod-ca-2021.crt')
  runtime ??= createRuntime({ defer: work => waitUntil(work) }).then(result => {
    if (onVercel) result.app.set('trust proxy', 1)
    return result
  }).catch(error => {
    runtime = undefined
    throw error
  })
  return runtime
}

// Preserve the request stream for Express's size-limited JSON and upload parsers.
export const config = { api: { bodyParser: false, externalResolver: true }, maxDuration: 60 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Express parses the URL query itself. Next also puts the catch-all path in req.query.
  Reflect.deleteProperty(req, 'query')
  delete req.headers['x-forwarded-for']
  const clientIp = req.headers['x-vercel-forwarded-for']
  if (onVercel && typeof clientIp === 'string' && isIP(clientIp)) req.headers['x-forwarded-for'] = clientIp
  try {
    const { app } = await hostedRuntime()
    await new Promise<void>((done, fail) => {
      res.once('finish', done)
      res.once('close', done)
      res.once('error', fail)
      app(req, res)
    })
  } catch {
    console.warn({ event: 'hosted_api_request_failed' })
    if (res.headersSent) { res.destroy(); return }
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ success: false, code: 'API_UNAVAILABLE', message: 'The account service is temporarily unavailable' })
  }
}
