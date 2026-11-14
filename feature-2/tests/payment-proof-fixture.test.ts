import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { renderPaymentProofFixture } from '../server/qa/payment-proof-fixture'

test('proof fixture renders distinct references using its bundled font without system fonts', async () => {
  const [accept, reject] = await Promise.all([
    renderPaymentProofFixture('C-MANUAL-ACCEPT-7D7EB971'),
    renderPaymentProofFixture('C-MANUAL-REJECT-7D7EB971'),
  ])
  const info = await sharp(accept).metadata()
  assert.equal(info.format, 'png'); assert.equal(info.width, 900); assert.equal(info.height, 460)
  // Equal-length references must produce different glyphs, not identical missing-glyph rectangles.
  assert.notDeepEqual(accept, reject)
  await assert.rejects(renderPaymentProofFixture('QA', '/nonexistent/qa-font.ttf'))
  await assert.rejects(renderPaymentProofFixture('<unsafe>'))
})
