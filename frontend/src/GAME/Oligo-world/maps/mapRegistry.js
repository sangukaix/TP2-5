import map001 from './map001'
import map002 from './map002'

function prepareMap(map) {
  const collisions = map.tiles.flatMap((row, y) =>
    [...row].flatMap((tile, x) => map.blockedTiles.includes(tile) ? [{ x, y }] : []))
  return { ...map, collisions }
}

export const mapRegistry = {
  map001: prepareMap(map001),
  map002: prepareMap(map002),
}

export function getMap(mapId) {
  return mapRegistry[mapId]
}
