import assert from 'node:assert/strict'
import test from 'node:test'
import { authApi } from './authApi.js'

test('signup sends a credentialed request and preserves duplicate error', async () => {
  const originalFetch = globalThis.fetch
  let captured
  globalThis.fetch = async (url, options) => {
    captured = { url, options }
    return { ok: false, status: 409, json: async () => ({
      detail: { code: 'DUPLICATE_USERNAME', message: '이미 사용 중인 아이디입니다.' },
    }) }
  }
  try {
    await assert.rejects(authApi.signup({ username: 'tester01' }), (error) =>
      error.code === 'DUPLICATE_USERNAME' && error.status === 409)
    assert.equal(captured.url, '/api/v1/auth/signup')
    assert.equal(captured.options.credentials, 'include')
    assert.equal(captured.options.method, 'POST')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('current user comes from /me and anonymous response stays unauthenticated', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 401,
    json: async () => ({ detail: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } }) })
  try {
    await assert.rejects(authApi.me(), (error) => error.status === 401)
  } finally {
    globalThis.fetch = originalFetch
  }
})
