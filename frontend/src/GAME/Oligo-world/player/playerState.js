import { getMap } from '../maps/mapRegistry'

export function createInitialPlayer(characterId) {
  return {
    characterId,
    level: 1,
    exp: 0,
    currencyW: 0,
    currentMapId: 'map001',
    position: { ...getMap('map001').spawn },
  }
}
