import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('Game Hub leads to the main game and the smaller quick game', async () => {
  const vite = await createServer({ server: { middlewareMode: true },
    appType: 'custom', logLevel: 'silent' })
  try {
    const { default: GameHub } = await vite.ssrLoadModule('/src/GAME/GameHub.jsx')
    const { default: LadderGame } = await vite.ssrLoadModule('/src/GAME/Ladder-game/LadderGame.jsx')
    const hub = renderToStaticMarkup(createElement(GameHub))
    const ladder = renderToStaticMarkup(createElement(LadderGame))
    assert.match(hub, /game-hub-world.*href="\/game\/oligo-world"/s)
    assert.match(hub, /game-hub-quick.*href="\/game\/ladder"/s)
    assert.match(ladder, /href="\/game"[^>]*>← GAME HUB/)
    assert.match(ladder, /참가자 1.*결과 1/s)
    assert.match(ladder, /사다리 만들기/)
  } finally {
    await vite.close()
  }
})

test('generation link opens Oligo World in a new tab inside the cancel condition', async () => {
  const source = await readFile(new URL('../pages/TourismStrategyPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /\{loading && <section[^\n]+\{canCancelJob && <div[^\n]+strategy-job-cancel[^\n]+href="\/game\/oligo-world" target="_blank" rel="noopener noreferrer"/)
})
