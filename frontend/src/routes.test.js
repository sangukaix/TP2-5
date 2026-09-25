import assert from 'node:assert/strict'
import test from 'node:test'

import { APP_ROUTES, ROUTE_ALIASES, resolveAppRoute, resolveProjectTreeUrl } from './routes.js'

test('현재 구현된 모든 페이지가 공개 경로에 연결되어 있다', () => {
  assert.deepEqual(APP_ROUTES, {
    '/': 'home',
    '/dashboard': 'dashboard',
    '/planning': 'planning',
    '/strategy': 'strategy',
    '/saved-plans': 'savedPlans',
    '/signup': 'signup',
    '/login': 'login',
    '/my': 'my',
    '/game': 'game',
    '/game/oligo-world': 'oligoWorld',
    '/game/ladder': 'ladderGame',
    '/admin-login': 'adminLogin',
    '/ml-test': 'mlTest',
    '/openai-test': 'openAiLearning',
    '/react-test': 'reactLearning',
    '/llm-control': 'llmControl',
    '/project-tree': 'projectTree',
  })
  assert.deepEqual(ROUTE_ALIASES, {
    '/diagnosis': '/dashboard',
    '/proposal': '/strategy',
  })
})

test('공개 화면 경로와 trailing slash를 명시적으로 해석한다', () => {
  assert.deepEqual(resolveAppRoute('/dashboard/'), {
    requestedPath: '/dashboard',
    canonicalPath: '/dashboard',
    pageId: 'dashboard',
    found: true,
  })
  assert.equal(resolveAppRoute('/planning').pageId, 'planning')
  assert.equal(resolveAppRoute('/signup').pageId, 'signup')
  assert.equal(resolveAppRoute('/login').pageId, 'login')
  assert.equal(resolveAppRoute('/my').pageId, 'my')
  assert.equal(resolveAppRoute('/game/').pageId, 'game')
  assert.equal(resolveAppRoute('/game/oligo-world').pageId, 'oligoWorld')
  assert.equal(resolveAppRoute('/game/ladder/').pageId, 'ladderGame')
  assert.equal(resolveAppRoute('/').pageId, 'home')
  assert.equal(resolveAppRoute('/strategy').pageId, 'strategy')
})

test('과거 주소는 지정된 화면으로만 연결한다', () => {
  assert.equal(resolveAppRoute('/diagnosis').canonicalPath, '/dashboard')
  assert.equal(resolveAppRoute('/proposal').canonicalPath, '/strategy')
})

test('알 수 없는 주소를 대시보드로 오인하지 않는다', () => {
  assert.deepEqual(resolveAppRoute('/missing'), {
    requestedPath: '/missing',
    canonicalPath: '/missing',
    pageId: null,
    found: false,
  })
})

test('구조 탐색기는 React에 접속한 같은 호스트의 8501 포트를 사용한다', () => {
  assert.equal(resolveProjectTreeUrl('', 'http://192.168.0.23:5176/react-test'), 'http://192.168.0.23:8501')
  assert.equal(resolveProjectTreeUrl('http://tree-host:9500/', 'http://localhost:5176'), 'http://tree-host:9500')
})
