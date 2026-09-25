import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('anonymous Oligo World asks for member login while keeping the mini game', async () => {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  try {
    const { default: OligoWorld } = await vite.ssrLoadModule('/src/GAME/Oligo-world/OligoWorld.jsx')
    const { AuthContext } = await vite.ssrLoadModule('/src/features/auth/useAuth.js')
    const html = renderToStaticMarkup(createElement(AuthContext.Provider, {
      value: { user: null, loading: false },
    }, createElement(OligoWorld)))
    assert.match(html, /OLIGO WORLD/)
    assert.match(html, /모험 기록은 회원 계정에 저장됩니다/)
    assert.match(html, /href="\/login"/)
    assert.match(html, /href="\/game\/ladder"[^>]*>.*점심메뉴 사다리타기/s)
  } finally {
    await vite.close()
  }
})

test('character creation shows one carousel character and a disabled incomplete form', async () => {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  try {
    const { default: CharacterSelect } = await vite.ssrLoadModule(
      '/src/GAME/Oligo-world/components/CharacterSelect.jsx')
    const html = renderToStaticMarkup(createElement(CharacterSelect, {
      memberRegionCode: '', onFinalized: () => {},
    }))
    assert.match(html, /Toki 캐릭터/)
    assert.doesNotMatch(html, /Hochi 캐릭터/)
    assert.match(html, /이전 캐릭터/)
    assert.match(html, /다음 캐릭터/)
    assert.match(html, /캐릭터 생성!<\/button>/)
    assert.match(html, /type="submit" disabled=""/)
  } finally {
    await vite.close()
  }
})

test('draft values, carousel order, region reset and nickname validation', async () => {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  try {
    const { default: CharacterSelect } = await vite.ssrLoadModule(
      '/src/GAME/Oligo-world/components/CharacterSelect.jsx')
    const { nextCharacterId, changeCreationSido, validCreationNickname } = await vite.ssrLoadModule(
      '/src/GAME/Oligo-world/characterCreation.js')
    assert.equal(nextCharacterId('toki', 1), 'hochi')
    assert.equal(nextCharacterId('hochi', 1), 'miho')
    assert.equal(nextCharacterId('miho', 1), 'toki')
    assert.equal(nextCharacterId('toki', -1), 'miho')
    assert.deepEqual(changeCreationSido({ sidoCode: '11', regionCode: '11680' }, '28'),
      { sidoCode: '28', regionCode: '' })
    assert.equal(validCreationNickname('관악산호랑이'), true)
    assert.equal(validCreationNickname('한'), false)
    assert.equal(validCreationNickname('has spaces'), false)
    assert.equal(validCreationNickname('a'.repeat(17)), false)
    const html = renderToStaticMarkup(createElement(CharacterSelect, {
      profile: { character_id: 'hochi', game_nickname: '관악산호랑이',
        region_code: '11680', travel_style: 'forest' },
      memberRegionCode: '11110', onFinalized: () => {},
    }))
    assert.match(html, /Hochi 캐릭터/)
    assert.match(html, /value="관악산호랑이"/)
    assert.match(html, /class="oligo-world-style-chip oligo-world-style-chip--active"[^>]*>숲/)
  } finally {
    await vite.close()
  }
})

test('active profile hydrates map and completed tutorial without character setup', async () => {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  try {
    const { stateFromProfile } = await vite.ssrLoadModule('/src/GAME/Oligo-world/gameState.js')
    const state = stateFromProfile({ profile_status: 'ACTIVE', character_id: 'miho',
      level: 1, exp: 10, currency_w: 10, current_map_id: 'map002',
      position_x: 6, position_y: 5, tutorial_stage: 'complete',
      tutorial_valid_moves: 4, tutorial_reward_granted: 1 })
    assert.equal(state.phase, 'playing')
    assert.equal(state.player.characterId, 'miho')
    assert.equal(state.player.currentMapId, 'map002')
    assert.equal(state.player.exp, 10)
    assert.equal(state.tutorial.rewardGranted, true)
    const pending = stateFromProfile({ profile_status: 'ACTIVE', character_id: 'toki',
      level: 1, exp: 0, currency_w: 0, current_map_id: 'map001',
      position_x: 1, position_y: 4, tutorial_stage: 'toDoor',
      tutorial_valid_moves: 4, tutorial_reward_granted: 0 })
    assert.equal(pending.phase, 'clear')
    assert.equal(pending.pendingMapId, 'map002')
  } finally {
    await vite.close()
  }
})

test('My Page keeps the game entry in a separate tab', async () => {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  try {
    const { default: My } = await vite.ssrLoadModule('/src/pages/My.jsx')
    const { AuthContext } = await vite.ssrLoadModule('/src/features/auth/useAuth.js')
    const html = renderToStaticMarkup(createElement(AuthContext.Provider, { value: {
      user: { username: 'test01', name: '테스트', email: 'test@example.com',
        phone: '', region_code: '' }, authenticated: true,
    } }, createElement(My)))
    assert.match(html, /MY PAGE.*href="\/game\/oligo-world" target="_blank" rel="noopener noreferrer"/s)
    assert.match(html, /Oligo World로 이동/)
  } finally {
    await vite.close()
  }
})
