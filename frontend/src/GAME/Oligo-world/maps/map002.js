import mountainImage from '../images/mountain1.png'

const tiles = [
  'PPPPPPPPPPPP',
  'P..........P',
  'P..R.......P',
  'P..........P',
  'P.......HH.P',
  'P.......HH.P',
  'PPPPPPPPPPPP',
]

export default {
  id: 'map002',
  name: '중지봉 · 집 앞',
  type: 'forest',
  width: 12,
  height: 7,
  spawn: { x: 6, y: 5 },
  tiles,
  blockedTiles: ['P', 'R', 'H'],
  exits: [],
  encounterEnabled: false,
  encounterRate: 0,
  encounterTable: [],
  firstVisitEvent: 'nextAdventure',
  background: mountainImage,
}
