import { getMap } from './maps/mapRegistry'
import { createInitialPlayer } from './player/playerState'
import { characters } from './characters'
import { advanceTutorial, createTutorial01, recordTutorialMove } from './tutorial/tutorial01'

const directions = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

export const initialGameState = {
  phase: 'title',
  selectedCharacterId: null,
  player: null,
  tutorial: null,
  visitedMaps: [],
  pendingMapId: null,
}

export function stateFromProfile(profile) {
  if (!profile || profile.profile_status !== 'ACTIVE' || !characters[profile.character_id] ||
      !getMap(profile.current_map_id)) return initialGameState
  const atTutorialExit = profile.current_map_id === 'map001' &&
    profile.tutorial_stage === 'toDoor' && !profile.tutorial_reward_granted &&
    profile.tutorial_valid_moves >= 4 &&
    profile.position_x === 1 && profile.position_y === 4
  return { phase: atTutorialExit ? 'clear' : 'playing', selectedCharacterId: profile.character_id,
    player: { characterId: profile.character_id, level: profile.level, exp: profile.exp,
      currencyW: profile.currency_w, currentMapId: profile.current_map_id,
      position: { x: profile.position_x, y: profile.position_y } },
    tutorial: { stage: atTutorialExit ? 'clear' : profile.tutorial_stage,
      validMoves: profile.tutorial_valid_moves,
      rewardGranted: Boolean(profile.tutorial_reward_granted) },
    visitedMaps: profile.current_map_id === 'map002' ? ['map001', 'map002'] : ['map001'],
    pendingMapId: atTutorialExit ? 'map002' : null }
}

export function movePlayer(player, map, direction) {
  const delta = directions[direction]
  if (!delta) return { position: player.position, moved: false, exit: null }
  const position = { x: player.position.x + delta.x, y: player.position.y + delta.y }
  const outside = position.x < 0 || position.y < 0 ||
    position.x >= map.width || position.y >= map.height
  const blocked = map.collisions.some(tile => tile.x === position.x && tile.y === position.y)
  if (outside || blocked) return { position: player.position, moved: false, exit: null }
  return { position, moved: true,
    exit: map.exits.find(tile => tile.x === position.x && tile.y === position.y) || null }
}

function grantTutorialReward(state, nextMapId) {
  if (state.tutorial.rewardGranted) return state
  return { ...state, phase: 'clear', pendingMapId: nextMapId,
    tutorial: { ...state.tutorial, stage: 'clear' } }
}

export function gameReducer(state, action) {
  if (action.type === 'HYDRATE_PROFILE') return stateFromProfile(action.profile)
  if (action.type === 'CONFIRM_TUTORIAL_REWARD' && state.phase === 'clear' &&
      action.profile?.tutorial_reward_granted) {
    return { ...state, player: { ...state.player, level: action.profile.level,
      exp: action.profile.exp, currencyW: action.profile.currency_w },
    tutorial: { ...state.tutorial, rewardGranted: true } }
  }
  if (action.type === 'START' && state.phase === 'title') {
    return { ...state, phase: 'select' }
  }
  if (action.type === 'SELECT_CHARACTER' && state.phase === 'select' &&
      characters[action.characterId]) {
    return { ...state, phase: 'playing', selectedCharacterId: action.characterId,
      player: createInitialPlayer(action.characterId), tutorial: createTutorial01(),
      visitedMaps: ['map001'], pendingMapId: null }
  }
  if (action.type === 'ADVANCE_DIALOGUE' && state.phase === 'playing' &&
      state.player.currentMapId === 'map001') {
    const tutorial = advanceTutorial(state.tutorial)
    if (tutorial.stage === 'toDoor') {
      const map = getMap('map001')
      const exit = map.exits.find(tile => tile.x === state.player.position.x &&
        tile.y === state.player.position.y)
      if (exit) return grantTutorialReward({ ...state, tutorial }, exit.to)
    }
    return { ...state, tutorial }
  }
  if (action.type === 'MOVE' && state.phase === 'playing' &&
      !['greeting', 'movementIntro', 'doorIntro'].includes(state.tutorial.stage)) {
    const map = getMap(state.player.currentMapId)
    const move = movePlayer(state.player, map, action.direction)
    if (!move.moved) return state
    const player = { ...state.player, position: move.position }
    const tutorial = recordTutorialMove(state.tutorial)
    const next = { ...state, player, tutorial }
    if (map.id === 'map001' && tutorial.stage === 'toDoor' && move.exit) {
      return grantTutorialReward(next, move.exit.to)
    }
    return next
  }
  if (action.type === 'ENTER_NEXT_MAP' && state.phase === 'clear' &&
      state.tutorial.rewardGranted) {
    const map = getMap(state.pendingMapId)
    if (!map) return state
    return { ...state, phase: 'playing', pendingMapId: null,
      player: { ...state.player, currentMapId: map.id, position: { ...map.spawn } },
      tutorial: { ...state.tutorial, stage: 'complete' },
      visitedMaps: state.visitedMaps.includes(map.id) ? state.visitedMaps :
        [...state.visitedMaps, map.id] }
  }
  return state
}
