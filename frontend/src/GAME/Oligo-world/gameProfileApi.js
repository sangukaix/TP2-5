const BASE = '/api/v1/game'

async function request(path, method = 'GET', data) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method, credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  } catch {
    throw new Error('게임 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.detail?.message || '게임 기록을 저장할 수 없습니다.')
    error.status = response.status
    error.code = body.detail?.code
    throw error
  }
  return body.profile
}

export const gameProfileApi = {
  load: () => request('/profile'),
  saveDraft: (data) => request('/profile/draft', 'PATCH', data),
  finalize: (data) => request('/profile/finalize', 'POST', data),
  saveProgress: (data) => request('/profile/progress', 'PATCH', data),
  completeTutorial: () => request('/tutorial/complete', 'POST'),
}
