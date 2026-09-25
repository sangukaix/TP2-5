import assert from 'node:assert/strict'
import test from 'node:test'
import { gameProfileApi } from './gameProfileApi.js'

test('game profile API uses the member cookie and never sends member_id', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => ({ profile: { profile_status: 'DRAFT' } }) }
  }
  try {
    assert.equal((await gameProfileApi.load()).profile_status, 'DRAFT')
    await gameProfileApi.saveDraft({ character_id: 'toki' })
    await gameProfileApi.finalize({ character_id: 'toki', game_nickname: '모험가',
      region_code: '11680', travel_style: 'mountain' })
    assert.deepEqual(calls.map(call => call.url), [
      '/api/v1/game/profile', '/api/v1/game/profile/draft', '/api/v1/game/profile/finalize',
    ])
    assert.ok(calls.every(call => call.options.credentials === 'include'))
    assert.ok(calls.every(call => !call.options.body?.includes('member_id')))
  } finally {
    globalThis.fetch = original
  }
})
