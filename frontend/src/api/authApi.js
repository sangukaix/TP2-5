const BASE = '/api/v1'

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')
  }
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.detail?.message || '요청을 처리할 수 없습니다.')
    error.code = body.detail?.code
    error.status = response.status
    throw error
  }
  return body
}

const send = (method, path, data) => request(path, { method, body: data ? JSON.stringify(data) : undefined })

export const authApi = {
  signup: (data) => send('POST', '/auth/signup', data),
  login: (data) => send('POST', '/auth/login', data),
  logout: () => send('POST', '/auth/logout'),
  me: () => request('/auth/me'),
  updateProfile: (data) => send('PATCH', '/users/me', data),
  changePassword: (data) => send('POST', '/auth/change-password', data),
  changeHint: (data) => send('POST', '/auth/change-hint', data),
  deleteAccount: () => send('DELETE', '/users/me'),
}
