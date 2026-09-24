import { useCallback, useEffect, useState } from 'react'
import { authApi } from '../../api/authApi'
import { AuthContext } from './useAuth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const next = await authApi.me()
      setUser(next)
      return next
    } catch {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    authApi.me().then((current) => {
      if (active) setUser(current)
    }).catch(() => {
      if (active) setUser(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const login = async (data) => {
    await authApi.login(data)
    const current = await refreshUser()
    if (!current) throw new Error('로그인 상태를 확인할 수 없습니다. 다시 시도해주세요.')
    return current
  }

  const logout = async () => {
    await authApi.logout()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, authenticated: Boolean(user), loading,
    refreshUser, login, logout, setUser }}>
    {children}
  </AuthContext.Provider>
}
