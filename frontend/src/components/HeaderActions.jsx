import { Moon, ShieldCheck, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, THEME_CHANGE_EVENT } from '../theme'
import { useAuth } from '../features/auth/useAuth'

function moveTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

export default function HeaderActions() {
  const [theme, setTheme] = useState(getStoredTheme)
  const { user, authenticated, loading, logout } = useAuth()

  useEffect(() => {
    const syncTheme = (event) => setTheme(event.detail || getStoredTheme())
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, syncTheme)
  }, [])

  const isNight = theme === 'night'
  const toggleTheme = () => {
    setTheme(applyTheme(isNight ? 'day' : 'night'))
  }

  return (
    <div className="global-header-actions">
      {!loading && !authenticated && <button type="button" className="account-action account-action--signup" onClick={() => moveTo('/signup')}>회원가입</button>}
      {!loading && !authenticated && <button type="button" className="account-action account-action--login" onClick={() => moveTo('/login')}>로그인</button>}
      {!loading && authenticated && <span className="header-username">{user.username}님</span>}
      {!loading && authenticated && <button type="button" className="account-action account-action--my" onClick={() => moveTo('/my')}>My Page</button>}
      {!loading && authenticated && <button type="button" className="account-action"
        onClick={() => logout().catch((error) => window.alert(error.message))}>로그아웃</button>}
      <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={isNight ? '주간 화면으로 전환' : '야간 화면으로 전환'}>
        {isNight ? <Sun size={16} /> : <Moon size={16} />}
        <span>{isNight ? 'Day Mode' : 'Night Mode'}</span>
      </button>
      <a className="admin-login-link" href="/admin-login"><ShieldCheck size={15} /><span>Admin</span></a>
    </div>
  )
}
