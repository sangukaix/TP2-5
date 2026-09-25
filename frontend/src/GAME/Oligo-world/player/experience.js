export function requiredExpForLevel(level) {
  return Math.max(1, level) * 100
}

export function addExp(player, amount) {
  if (!Number.isFinite(amount) || amount < 0) return player
  let { level, exp } = player
  exp += amount
  while (exp >= requiredExpForLevel(level)) {
    exp -= requiredExpForLevel(level)
    level += 1
  }
  return { ...player, level, exp }
}
