import assert from 'node:assert/strict'
import { test } from 'node:test'
import { featureOneUrl } from '../feature-2/lib/feature-one-links'

test('combined navigation keeps account, discovery and creation on the current host', () => {
  const previous = process.env.NEXT_PUBLIC_TEMUEVENT_COMBINED
  process.env.NEXT_PUBLIC_TEMUEVENT_COMBINED = 'true'
  try {
    assert.equal(featureOneUrl('/'), '/')
    assert.equal(featureOneUrl('/organizer/events/new'), '/organizer/events/new')
    assert.equal(featureOneUrl('//example.test/organizer'), null)
    assert.equal(featureOneUrl('/\\example.test/organizer'), null)
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_TEMUEVENT_COMBINED
    else process.env.NEXT_PUBLIC_TEMUEVENT_COMBINED = previous
  }
})
