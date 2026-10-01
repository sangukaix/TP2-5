export const WORKSPACE_SESSION_MODE_KEY = 'tour-insight-workspace-session-mode'
export const LAST_RESUME_REGION_KEY = 'tour-insight-last-resume-region'
export const DEFAULT_RESUME_REGION_CODE = '11200'

function browserSessionStorage() {
  return typeof window === 'undefined' ? null : window.sessionStorage
}

function browserLocalStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function writeMode(mode, storage = browserSessionStorage()) {
  try {
    storage?.setItem(WORKSPACE_SESSION_MODE_KEY, mode)
    return true
  } catch {
    return false
  }
}

/** 저장된 기획서는 유지하면서 현재 탭만 새 작업 흐름으로 시작합니다. */
export function beginNewWorkspaceSession(storage) {
  return writeMode('new', storage)
}

/** 저장기록 또는 생성 작업을 다시 열 때 기존 결과 복원을 허용합니다. */
export function beginResumeWorkspaceSession(storage) {
  return writeMode('resume', storage)
}

/** 모드 값이 없는 직접 접속은 기존 호환성을 위해 이어가기 흐름으로 처리합니다. */
export function isNewWorkspaceSession(storage = browserSessionStorage()) {
  try {
    return storage?.getItem(WORKSPACE_SESSION_MODE_KEY) === 'new'
  } catch {
    return false
  }
}

/** 처음 이어갈 기획서는 성동구이며, 새 결과를 저장하면 그 지역으로 갱신합니다. */
export function readResumeRegionCode(storage = browserLocalStorage()) {
  try {
    return storage?.getItem(LAST_RESUME_REGION_KEY) || DEFAULT_RESUME_REGION_CODE
  } catch {
    return DEFAULT_RESUME_REGION_CODE
  }
}

export function saveResumeRegionCode(regionCode, storage = browserLocalStorage()) {
  if (!regionCode) return false
  try {
    storage?.setItem(LAST_RESUME_REGION_KEY, regionCode)
    return true
  } catch {
    return false
  }
}
