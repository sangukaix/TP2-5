import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptsDemoLogin, createDemoProfileApi } from './demoProfile.js'

test('temporary login accepts only the requested preview credentials', () => {
  assert.equal(acceptsDemoLogin('admin', '1234'), true)
  assert.equal(acceptsDemoLogin('admin', 'wrong'), false)
  assert.equal(acceptsDemoLogin('other', '1234'), false)
})

test('preview keeps only the new character in this session', async () => {
  const api = createDemoProfileApi()
  await api.saveDraft({ character_id: 'toki', region_code: '11680' })
  const character = { character_id: 'miho', game_nickname: '체험자', region_code: null,
    region_name: null, travel_styles: ['forest', 'ocean'] }
  const active = await api.finalize(character)
  assert.deepEqual(active, { ...character, profile_status: 'ACTIVE' })
  assert.deepEqual(await api.load(), active)
  assert.equal(await createDemoProfileApi().load(), null)
})
