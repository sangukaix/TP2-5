export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

export function generateLadder(count, random = Math.random) {
  if (!Number.isInteger(count) || count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new RangeError(`참가자는 ${MIN_PLAYERS}명부터 ${MAX_PLAYERS}명까지 가능합니다.`)
  }

  const rowCount = Math.max(10, count * 3)
  const rows = []
  let previous = new Set()

  for (let row = 0; row < rowCount; row += 1) {
    const candidates = Array.from({ length: count - 1 }, (_, index) => index)
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1))
      const candidate = candidates[index]
      candidates[index] = candidates[swapIndex]
      candidates[swapIndex] = candidate
    }

    const chosen = []
    for (const left of candidates) {
      if (previous.has(left) || chosen.some((other) => Math.abs(other - left) <= 1)) continue
      if (random() < 0.45) chosen.push(left)
    }
    chosen.sort((left, right) => left - right)
    rows.push(chosen)
    previous = new Set(chosen)
  }

  if (rows.every((row) => row.length === 0)) {
    rows[Math.floor(rowCount / 2)] = [Math.floor(random() * (count - 1))]
  }
  return { count, rows }
}

export function traceLadder(ladder, startIndex) {
  if (!ladder || !Number.isInteger(startIndex) || startIndex < 0 || startIndex >= ladder.count) {
    throw new RangeError('올바른 참가자를 선택해 주세요.')
  }

  let position = startIndex
  const crossings = []
  ladder.rows.forEach((row, rowIndex) => {
    const from = position
    if (row.includes(position)) position += 1
    else if (row.includes(position - 1)) position -= 1
    if (position !== from) crossings.push({ row: rowIndex, from, to: position })
  })
  return { endIndex: position, crossings }
}

export function validateLadderEntries(participants, results) {
  if (participants.length !== results.length) return '참가자 수와 결과 수를 같게 해 주세요.'
  if (participants.length < MIN_PLAYERS || participants.length > MAX_PLAYERS) {
    return `참가자는 ${MIN_PLAYERS}명부터 ${MAX_PLAYERS}명까지 가능합니다.`
  }
  if (participants.some((name) => !name.trim())) return '모든 참가자 이름을 입력해 주세요.'
  if (results.some((result) => !result.trim())) return '모든 결과를 입력해 주세요.'
  return ''
}
