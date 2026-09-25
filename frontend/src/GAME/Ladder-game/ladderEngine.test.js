import assert from 'node:assert/strict'
import test from 'node:test'
import { generateLadder, traceLadder, validateLadderEntries,
  MIN_PLAYERS, MAX_PLAYERS } from './ladderEngine.js'

function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 2 ** 32
  }
}

test('2명부터 8명까지 인접 가로선 없이 사다리를 만든다', () => {
  for (let count = MIN_PLAYERS; count <= MAX_PLAYERS; count += 1) {
    const ladder = generateLadder(count, seededRandom(count))
    assert.equal(ladder.count, count)
    assert.ok(ladder.rows.some((row) => row.length > 0))
    for (const row of ladder.rows) {
      for (let index = 0; index < row.length; index += 1) {
        assert.ok(row[index] >= 0 && row[index] < count - 1)
        if (index) assert.ok(row[index] - row[index - 1] > 1)
      }
    }
  }
  assert.throws(() => generateLadder(1), RangeError)
  assert.throws(() => generateLadder(9), RangeError)
})

test('경로는 실제 가로선만 따라가며 모든 결과에 정확히 한 명씩 도착한다', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    for (let count = MIN_PLAYERS; count <= MAX_PLAYERS; count += 1) {
      const ladder = generateLadder(count, seededRandom(seed * 100 + count))
      const destinations = new Set()
      for (let start = 0; start < count; start += 1) {
        const { endIndex, crossings } = traceLadder(ladder, start)
        destinations.add(endIndex)
        for (const crossing of crossings) {
          assert.equal(Math.abs(crossing.from - crossing.to), 1)
          assert.ok(ladder.rows[crossing.row].includes(Math.min(crossing.from, crossing.to)))
        }
      }
      assert.equal(destinations.size, count)
      assert.deepEqual([...destinations].sort((a, b) => a - b),
        Array.from({ length: count }, (_, index) => index))
    }
  }
})

test('시작 전 참가자·결과 개수와 빈 입력을 검증한다', () => {
  assert.match(validateLadderEntries(['가', '나'], ['메뉴']), /같게/)
  assert.match(validateLadderEntries(['가', ''], ['한식', '중식']), /참가자/)
  assert.match(validateLadderEntries(['가', '나'], ['한식', '  ']), /결과/)
  assert.equal(validateLadderEntries([' 가 ', '나'], ['한식', '중식']), '')
})
