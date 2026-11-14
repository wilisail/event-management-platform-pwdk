import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

// Maintenance/test utility only; never imported by the normal application API.
export async function renderPaymentProofFixture(reference: string,
  fontFile = resolve(import.meta.dirname, '../../assets/fonts/DejaVuSans-qa.ttf')): Promise<Buffer> {
  if (!/^[A-Z0-9-]{1,64}$/.test(reference)) throw new Error('Invalid test proof reference')
  // An explicit, bundled font is required. Serverless hosts may have no system fonts.
  await access(fontFile)
  const lines = [
    ['TemuEvent - BUKTI PEMBAYARAN UJI', 28, '#5749dc', 60],
    [reference, 25, '#161324', 140],
    ['TIDAK ADA UANG DITRANSFER', 30, '#b52d2c', 220],
    ['Dokumen simulasi untuk pengujian integrasi F2.', 21, '#161324', 305],
    ['Bukan bukti transfer bank atau pembayaran nyata.', 21, '#161324', 365],
  ] as const
  const layers = await Promise.all(lines.map(async ([text, size, color, top]) => ({
    input: await sharp({ text: { text: `<span foreground="${color}">${text}</span>`,
      font: `DejaVu Sans ${size}`, fontfile: fontFile, rgba: true, dpi: 72 } }).png().toBuffer(),
    left: 60, top,
  })))
  return sharp({ create: { width: 900, height: 460, channels: 4, background: '#faf9ff' } })
    .composite(layers).png().toBuffer()
}
