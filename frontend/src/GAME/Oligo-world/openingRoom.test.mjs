import assert from 'node:assert/strict'
import test from 'node:test'
import { canStandAt, mihoLayout, practiceOrder, roomSpawn, walkInRoom } from './tutorial/openingRoom.js'

test('Miho wakes beside the rug and walks around the furniture in her own room', () => {
  assert.ok(canStandAt(mihoLayout.spawn, mihoLayout))
  assert.ok(canStandAt({ x: 31, y: 44 }, mihoLayout))
  for (const [x, y] of [[28, 41], [45, 44], [52, 46], [10, 55], [62, 42], [75, 45], [85, 57], [98, 15]]) {
    assert.equal(canStandAt({ x, y }, mihoLayout), false, `blocked at ${x}, ${y}`)
  }
  assert.ok(canStandAt({ x: 60, y: 68 }, mihoLayout))
  const start = { position: mihoLayout.spawn, lesson: 0 }
  for (const key of practiceOrder) assert.ok(walkInRoom(start, key, .36, mihoLayout).walking)
})

test('room spawn and rug allow feet, furniture and room edges block them', () => {
  assert.equal(canStandAt(roomSpawn), true)
  assert.equal(canStandAt({ x: 27, y: 63 }), true)
  for (const [x, y] of [[20, 58], [10, 68], [49, 64], [61, 69], [97, 90], [74, 99]]) {
    assert.equal(canStandAt({ x, y }), false)
  }
})

test('practice advances only for a successful step in the requested direction', () => {
  const besideDesk = { position: { x: 51.7, y: 75 }, lesson: 0 }
  const blocked = walkInRoom(besideDesk, 'ArrowRight', .36)
  assert.equal(blocked.position, besideDesk.position)
  assert.equal(blocked.walking, false)
  assert.equal(blocked.lesson, 0)
  let state = walkInRoom({ position: roomSpawn, lesson: 0 }, 'ArrowUp', .36)
  assert.ok(state.position.y < roomSpawn.y)
  assert.equal(state.lesson, 0)
  for (const [index, key] of practiceOrder.entries()) {
    state = walkInRoom(state, key, .36)
    assert.equal(state.facing, key)
    assert.equal(state.lesson, index + 1)
  }
  assert.equal(walkInRoom(state, 'ArrowRight', .36).lesson, practiceOrder.length)
})
