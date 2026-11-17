import type { NextApiRequest, NextApiResponse } from 'next'
import { waitUntil } from '@vercel/functions'
import { isIP } from 'node:net'
import { createIntegratedRuntime } from '../../server/integration-runtime'

export const config = { api: { bodyParser: false, externalResolver: true }, maxDuration: 60 }
let runtime: ReturnType<typeof createIntegratedRuntime> | undefined

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Let Express derive query fields from the URL, without Next's catch-all path parameter.
  Reflect.deleteProperty(req, 'query')
  delete req.headers['x-forwarded-for']
  const clientIp = req.headers['x-vercel-forwarded-for']
  if (process.env.VERCEL === '1' && typeof clientIp === 'string' && isIP(clientIp)) req.headers['x-forwarded-for'] = clientIp
  try {
    const current = await (runtime ??= createIntegratedRuntime({ defer: work => waitUntil(work) }).then(result => {
      if (process.env.VERCEL === '1') result.app.set('trust proxy', 1)
      return result
    }))
    await new Promise<void>((done, fail) => {
      res.once('finish', done); res.once('close', done); res.once('error', fail)
      current.app(req, res)
    })
  } catch {
    runtime = undefined
    if (res.headersSent) { res.destroy(); return }
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ success: false, code: 'API_UNAVAILABLE', message: 'The service is temporarily unavailable' })
  }
}
