export const characterIds = ['toki', 'hochi', 'miho']

export function nextCharacterId(currentId, step) {
  const index = characterIds.indexOf(currentId)
  return characterIds[(index + step + characterIds.length) % characterIds.length]
}

export function changeCreationSido(form, sidoCode) {
  return { ...form, sidoCode, regionCode: '' }
}

export function validCreationNickname(value) {
  return /^[가-힣A-Za-z0-9_]{2,16}$/.test(value.trim())
}
