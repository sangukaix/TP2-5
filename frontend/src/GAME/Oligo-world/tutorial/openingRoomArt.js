import originalHome from '../images/places/Home1.png'
import { originalLayout, mihoLayout } from './openingRoom'

// The filename suffixes are 0 empty, 1 asleep, 2 and 3 lightning.
function numberedRoom(images, layout = originalLayout) {
  const frames = Object.keys(images).sort().map(path => images[path])
  if (frames.length !== 4) throw new Error('튜토리얼 방 이미지 0~3번이 모두 필요합니다.')
  const [empty, sleep, first, second] = frames
  return { empty, sleep, strike: [first, second], layout }
}

const originalRoom = { empty: originalHome, sleep: null, strike: [], layout: originalLayout }
const rooms = {
  miho: numberedRoom(import.meta.glob('../images/places/Home1_Miho[0-3].png', { eager: true, import: 'default' }), mihoLayout),
  // images/places에 네 장을 준비한 뒤 해당 캐릭터의 한 줄을 활성화한다.
  // hochi: numberedRoom(import.meta.glob('../images/places/Home1_Hochi[0-3].png', { eager: true, import: 'default' })),
  // toki: numberedRoom(import.meta.glob('../images/places/Home1_Toki[0-3].png', { eager: true, import: 'default' })),
}

export function openingRoomFor(characterId) {
  return rooms[characterId] ?? originalRoom
}
