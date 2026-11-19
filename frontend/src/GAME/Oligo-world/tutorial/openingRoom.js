// All points use percentages of the uncropped 1671 × 941 Home1.png.
const floor = [[4, 68], [37, 45], [54, 47], [69, 54], [95, 78], [96, 85],
  [85, 98], [29, 98], [4, 89]]
const furniture = [
  [[7, 61], [26, 48], [38, 43], [39, 48], [19, 69], [8, 69]], // Bed
  [[6, 60], [13, 58], [17, 67], [13, 74], [5, 71]], // Bedside stool
  [[45, 49], [49, 47], [53, 59], [53, 69], [46, 70]], // Chair
  [[52, 53], [58, 48], [67, 48], [67, 76], [53, 76]], // Desk
  [[78, 63], [80, 63], [80, 65], [78, 65]], // Staff at the wall
]

export const roomSpawn = { x: 34, y: 71 }
export const originalLayout = { spawn: roomSpawn, floor, furniture, aspect: 1671 / 941 }

// Percentages of Home1_Miho0.png. Each polygon follows the furniture at floor level.
export const mihoLayout = {
  spawn: { x: 34, y: 50 },
  aspect: 1670 / 941,
  floor: [[3.9, 62.5], [29.6, 35], [64, 40], [82, 45.6], [96.7, 67.1],
    [96.7, 72.4], [99, 76.5], [86.3, 99.4], [35, 99.4], [0.8, 87.5], [0.8, 75], [3.9, 72]],
  furniture: [
    [[17, 43.7], [26.5, 32.5], [35.4, 34.9], [35.2, 37.6], [24.9, 48.7], [17.2, 46.8]], // Bed
    [[17.5, 45.3], [20.9, 43], [23.2, 45.2], [21.3, 50.8], [17.6, 50]], // Bedside stool
    [[42.8, 38.2], [44.9, 37.1], [47.5, 38.7], [47.4, 46], [43.4, 45.4]], // Chair
    [[47.6, 38.2], [50.6, 33.5], [56.6, 34.6], [56.3, 41.5], [54.7, 48.3], [48.2, 47.6]], // Desk
    [[4.7, 53], [14.4, 45.5], [15.9, 46.5], [15.6, 54.1], [8.7, 62.9], [4.6, 62.2]], // Cabinet
    [[58.8, 39.7], [66.8, 39.8], [66.2, 44.9], [58.7, 43.4]], // Bookshelf
    [[69.9, 42.5], [80.5, 43.7], [80.1, 48.1], [69.5, 45.6]], // Rack
    [[81.3, 49], [89, 50.8], [90.2, 52.3], [90, 58.6], [87.9, 60], [81.3, 57]], // Vanity
    [[82.4, 54], [86.2, 54.5], [86, 60.1], [82.7, 58.9]], // Vanity stool
  ],
}
export const directionKeys = {
  ArrowRight: { name: '오른쪽', glyph: '→', x: 1, y: 0 },
  ArrowLeft: { name: '왼쪽', glyph: '←', x: -1, y: 0 },
  ArrowUp: { name: '위', glyph: '↑', x: 0, y: -1 },
  ArrowDown: { name: '아래', glyph: '↓', x: 0, y: 1 },
}
export const practiceOrder = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']

function inside(x, y, polygon) {
  let contained = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i]
    const [bx, by] = polygon[j]
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) {
      contained = !contained
    }
  }
  return contained
}

const footOffsets = [[0, 0], [-1.25, 0], [1.25, 0], [0, -1.6], [0, 1.6]]
export function canStandAt({ x, y }, layout = originalLayout) {
  return footOffsets.every(([dx, dy]) =>
    inside(x + dx, y + dy, layout.floor) &&
    !layout.furniture.some(polygon => inside(x + dx, y + dy, polygon)))
}

export function walkInRoom(state, key, distance, layout = originalLayout) {
  const direction = directionKeys[key]
  const position = {
    x: state.position.x + direction.x * distance,
    y: state.position.y + direction.y * distance * layout.aspect,
  }
  if (!canStandAt(position, layout)) {
    return state.facing === key && !state.walking ? state : { ...state, facing: key, walking: false }
  }
  return {
    position, facing: key, walking: true,
    lesson: state.lesson + Number(key === practiceOrder[state.lesson]),
  }
}
