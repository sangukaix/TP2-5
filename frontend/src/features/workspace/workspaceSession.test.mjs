import assert from 'node:assert/strict'
import test from 'node:test'
import {
  beginNewWorkspaceSession,
  beginResumeWorkspaceSession,
  DEFAULT_RESUME_REGION_CODE,
  isNewWorkspaceSession,
  LAST_RESUME_REGION_KEY,
  readResumeRegionCode,
  saveResumeRegionCode,
  WORKSPACE_SESSION_MODE_KEY,
} from './workspaceSession.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('새 작업 모드는 저장 기획서 복원을 막는다', () => {
  const storage = memoryStorage()
  assert.equal(isNewWorkspaceSession(storage), false)
  assert.equal(beginNewWorkspaceSession(storage), true)
  assert.equal(storage.getItem(WORKSPACE_SESSION_MODE_KEY), 'new')
  assert.equal(isNewWorkspaceSession(storage), true)
})

test('이어가기 모드는 저장 기획서 복원을 다시 허용한다', () => {
  const storage = memoryStorage()
  beginNewWorkspaceSession(storage)
  assert.equal(beginResumeWorkspaceSession(storage), true)
  assert.equal(storage.getItem(WORKSPACE_SESSION_MODE_KEY), 'resume')
  assert.equal(isNewWorkspaceSession(storage), false)
})

test('첫 이어가기 대상은 성동구이고 새 기획서 저장 지역으로 갱신된다', () => {
  const storage = memoryStorage()
  assert.equal(readResumeRegionCode(storage), DEFAULT_RESUME_REGION_CODE)
  assert.equal(saveResumeRegionCode('11680', storage), true)
  assert.equal(storage.getItem(LAST_RESUME_REGION_KEY), '11680')
  assert.equal(readResumeRegionCode(storage), '11680')
})
