import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

async function loadGame() {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  const game = await vite.ssrLoadModule('/src/GAME/Oligo-world/gameState.js')
  const maps = await vite.ssrLoadModule('/src/GAME/Oligo-world/maps/mapRegistry.js')
  const growth = await vite.ssrLoadModule('/src/GAME/Oligo-world/player/experience.js')
  return { vite, ...game, ...maps, ...growth }
}

test('map registry keeps dimensions, collisions and future metadata', async () => {
  const { vite, getMap } = await loadGame()
  try {
    for (const id of ['map001', 'map002']) {
      const map = getMap(id)
      assert.equal(map.id, id)
      assert.equal(map.tiles.length, map.height)
      assert.ok(map.tiles.every(row => row.length === map.width))
      assert.equal(map.encounterEnabled, false)
      assert.equal(map.encounterRate, 0)
      assert.ok(map.firstVisitEvent)
      assert.ok(map.background)
    }
    assert.equal(getMap('map001').exits[0].to, 'map002')
  } finally {
    await vite.close()
  }
})

test('pure reducer selection creates the chosen level-one player', async () => {
  const { vite, gameReducer, initialGameState, getMap, requiredExpForLevel } = await loadGame()
  try {
    const select = gameReducer(initialGameState, { type: 'START' })
    assert.equal(select.phase, 'select')
    assert.equal(gameReducer(select, { type: 'SELECT_CHARACTER', characterId: 'unknown' }), select)
    for (const characterId of ['toki', 'hochi', 'miho']) {
      const state = gameReducer(select, { type: 'SELECT_CHARACTER', characterId })
      assert.equal(state.selectedCharacterId, characterId)
      assert.deepEqual(state.player, { characterId, level: 1, exp: 0, currencyW: 0,
        currentMapId: 'map001', position: getMap('map001').spawn })
      assert.deepEqual(state.visitedMaps, ['map001'])
    }
    assert.equal(requiredExpForLevel(1), 100)
  } finally {
    await vite.close()
  }
})

test('only valid moves advance tutorial; walls, furniture and bounds block movement', async () => {
  const { vite, gameReducer, initialGameState, getMap, movePlayer } = await loadGame()
  try {
    let state = gameReducer(gameReducer(initialGameState, { type: 'START' }),
      { type: 'SELECT_CHARACTER', characterId: 'toki' })
    const map = getMap('map001')
    assert.equal(movePlayer({ position: { x: 4, y: 1 } }, map, 'ArrowRight').moved, false)
    assert.equal(movePlayer({ position: { x: 0, y: 0 } }, map, 'ArrowLeft').moved, false)
    assert.equal(movePlayer({ position: { x: 1, y: 1 } }, map, 'ArrowLeft').moved, false)
    state = gameReducer(state, { type: 'ADVANCE_DIALOGUE' })
    state = gameReducer(state, { type: 'ADVANCE_DIALOGUE' })
    assert.equal(state.tutorial.stage, 'moving')
    const besideBed = { ...state,
      player: { ...state.player, position: { x: 4, y: 1 } } }
    const blocked = gameReducer(besideBed, { type: 'MOVE', direction: 'ArrowRight' })
    assert.equal(blocked, besideBed)
    assert.equal(blocked.tutorial.validMoves, 0)
    state = gameReducer(state, { type: 'MOVE', direction: 'ArrowLeft' })
    assert.equal(state.tutorial.validMoves, 1)
    state = gameReducer(state, { type: 'MOVE', direction: 'ArrowLeft' })
    state = gameReducer(state, { type: 'MOVE', direction: 'ArrowLeft' })
    state = gameReducer(state, { type: 'MOVE', direction: 'ArrowLeft' })
    assert.equal(state.tutorial.validMoves, 4)
    assert.equal(state.tutorial.stage, 'doorIntro')
    assert.deepEqual(state.player.position, { x: 1, y: 3 })
  } finally {
    await vite.close()
  }
})

test('exit waits for confirmed reward before entering map002', async () => {
  const { vite, gameReducer, initialGameState, getMap, movePlayer, addExp } = await loadGame()
  try {
    let state = gameReducer(gameReducer(initialGameState, { type: 'START' }),
      { type: 'SELECT_CHARACTER', characterId: 'miho' })
    state = gameReducer(state, { type: 'ADVANCE_DIALOGUE' })
    state = gameReducer(state, { type: 'ADVANCE_DIALOGUE' })
    for (const direction of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
      state = gameReducer(state, { type: 'MOVE', direction })
    }
    state = gameReducer(state, { type: 'ADVANCE_DIALOGUE' })
    assert.equal(state.tutorial.stage, 'toDoor')
    state = gameReducer(state, { type: 'MOVE', direction: 'ArrowDown' })
    assert.equal(state.phase, 'clear')
    assert.equal(state.pendingMapId, 'map002')
    assert.equal(state.tutorial.rewardGranted, false)
    assert.equal(state.player.exp, 0)
    assert.equal(state.player.currencyW, 0)
    assert.deepEqual(state.player.position, { x: 1, y: 4 })
    assert.deepEqual(gameReducer(state, { type: 'MOVE', direction: 'ArrowDown' }), state)
    state = gameReducer(state, { type: 'CONFIRM_TUTORIAL_REWARD', profile: {
      level: 1, exp: 10, currency_w: 10, tutorial_reward_granted: 1,
    } })
    assert.equal(state.tutorial.rewardGranted, true)
    state = gameReducer(state, { type: 'ENTER_NEXT_MAP' })
    assert.equal(state.phase, 'playing')
    assert.equal(state.pendingMapId, null)
    assert.equal(state.player.currentMapId, 'map002')
    assert.deepEqual(state.player.position, getMap('map002').spawn)
    assert.deepEqual(state.visitedMaps, ['map001', 'map002'])
    assert.equal(state.player.exp, 10)
    assert.equal(state.player.currencyW, 10)
    assert.deepEqual(gameReducer(state, { type: 'ENTER_NEXT_MAP' }), state)
    assert.equal(movePlayer(state.player, getMap('map002'), 'ArrowRight').moved, true)
    assert.deepEqual(addExp({ level: 1, exp: 95 }, 10), { level: 2, exp: 5 })
  } finally {
    await vite.close()
  }
})
