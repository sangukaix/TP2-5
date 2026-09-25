import homeImage from '../images/Home.png'

const tiles = [
  '############',
  '#....bb.ss.#',
  '#....bb.ss.#',
  '#..........#',
  '#D..tttt...#',
  '#...tttt...#',
  '############',
]

export default {
  id: 'map001',
  name: '중지봉의 집',
  type: 'home',
  width: 12,
  height: 7,
  spawn: { x: 5, y: 3 },
  tiles,
  blockedTiles: ['#', 'b', 't', 's'],
  exits: [{ x: 1, y: 4, to: 'map002' }],
  encounterEnabled: false,
  encounterRate: 0,
  encounterTable: [],
  firstVisitEvent: 'tutorial01',
  background: homeImage,
}
