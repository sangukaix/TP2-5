import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('Header shows the current user only for an authenticated session', async () => {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  try {
    const { default: HeaderActions } = await vite.ssrLoadModule('/src/components/HeaderActions.jsx')
    const { AuthContext } = await vite.ssrLoadModule('/src/features/auth/useAuth.js')
    const render = (value) => renderToStaticMarkup(createElement(AuthContext.Provider, { value },
      createElement(HeaderActions)))
    const anonymous = render({ user: null, authenticated: false, loading: false })
    assert.match(anonymous, /회원가입.*로그인.*Day Mode.*Admin/s)
    assert.doesNotMatch(anonymous, /My Page|로그아웃|header-username/)

    const authenticated = render({ user: { username: 'test01' },
      authenticated: true, loading: false })
    assert.match(authenticated, /test01님.*My Page.*로그아웃.*Day Mode.*Admin/s)
    assert.doesNotMatch(authenticated, /회원가입|>로그인</)
  } finally {
    await vite.close()
  }
})

test('anonymous visitors can still see the BYOK key connection panel', async () => {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  try {
    const { default: ByokConnectionPanel } = await vite.ssrLoadModule('/src/components/ByokConnectionPanel.jsx')
    const html = renderToStaticMarkup(createElement(ByokConnectionPanel, { connection: {
      capability: { requires_user_api_key: true }, session: { connected: false },
      apiKey: '', busy: false, setApiKey: () => {}, connect: async () => {},
    } }))
    assert.match(html, /OpenAI API Key/)
    assert.match(html, /OpenAI 연결/)
  } finally {
    await vite.close()
  }
})
