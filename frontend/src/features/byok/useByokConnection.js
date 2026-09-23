import { useCallback, useEffect, useState } from 'react'
import { connectByokSession, disconnectByokSession, getByokCapability, getByokSession } from '../../api/dashboardApi'

/** Raw API Key는 이 hook의 React state에만 잠시 존재하고 브라우저 저장소로 전달하지 않습니다. */
export function useByokConnection(onChange) {
  const [capability, setCapability] = useState(null)
  const [session, setSession] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const publish = useCallback((nextSession) => {
    setSession(nextSession)
    onChange?.(nextSession)
  }, [onChange])

  const refresh = useCallback(async () => {
    const nextCapability = await getByokCapability()
    setCapability(nextCapability)
    const nextSession = nextCapability.requires_user_api_key
      ? await getByokSession()
      : { connected: false, runtime_mode: nextCapability.runtime_mode }
    publish(nextSession)
    return { capability: nextCapability, session: nextSession }
  }, [publish])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      refresh().catch((error) => { if (active) setMessage(error.message) })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [refresh])

  const connect = useCallback(async () => {
    const submittedKey = apiKey.trim()
    if (!submittedKey) {
      setMessage('OpenAI API Key를 입력해주세요.')
      return false
    }
    setBusy(true)
    setMessage('')
    try {
      publish(await connectByokSession(submittedKey))
      setApiKey('')
      setMessage('OpenAI 연결이 준비되었습니다. 실제 생성 시 Key 권한과 사용량이 확인됩니다.')
      return true
    } catch (error) {
      publish({ connected: false, runtime_mode: 'openai_byok' })
      setMessage(error.message)
      return false
    } finally {
      setBusy(false)
    }
  }, [apiKey, publish])

  const disconnect = useCallback(async () => {
    setBusy(true)
    setMessage('')
    try {
      publish(await disconnectByokSession())
      setMessage('OpenAI 연결을 해제했습니다.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }, [publish])

  return {
    apiKey,
    busy,
    capability,
    clearMessage: () => setMessage(''),
    connect,
    disconnect,
    message,
    refresh,
    session,
    setApiKey,
  }
}
