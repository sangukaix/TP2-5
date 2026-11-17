import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptsDemoLogin, createDemoProfileApi } from './demoProfile.js'

test('temporary login accepts only the requested preview credentials', () => {
  assert.equal(acceptsDemoLogin('admin', '1234'), true)
  assert.equal(acceptsDemoLogin('admin', 'wrong'), false)
  assert.equal(acceptsDemoLogin('other', '1234'), false)
})

test('preview supports creation and tutorial without persistent member access', async () => {
  const api = createDemoProfileApi()
  await api.saveDraft({ character_id: 'miho' })
  const active = await api.finalize({ character_id: 'miho', game_nickname: '체험자' })
  assert.equal(active.profile_status, 'ACTIVE')
  assert.equal(active.current_map_id, 'map001')
  await api.completeTutorial()
  assert.equal((await api.completeTutorial()).exp, 10)
  assert.equal((await api.load()).current_map_id, 'map002')
  assert.equal(await createDemoProfileApi().load(), null)
})
