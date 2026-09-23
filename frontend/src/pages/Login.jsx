import { useState } from 'react'
import { KeyRound, LockKeyhole, Mail, UserRound } from 'lucide-react'
import '../App.css'
import './Login.css'
import nightLogo from '../assets/logo5.png'
import dayLogo from '../assets/logo6.png'

const INITIAL_LOGIN = { userId: '', password: '' }

function moveTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0 })
}

function handlePageLink(path) {
  return (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    moveTo(path)
  }
}

export default function Login() {
  const [view, setView] = useState('login')
  const [loginData, setLoginData] = useState(INITIAL_LOGIN)
  const [loginErrors, setLoginErrors] = useState({})
  const [loginNotice, setLoginNotice] = useState('')
  const [recoveryUserId, setRecoveryUserId] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [recoveryErrors, setRecoveryErrors] = useState({})
  const [recoveryNotice, setRecoveryNotice] = useState('')
  const [findIdEmail, setFindIdEmail] = useState('')
  const [findIdError, setFindIdError] = useState('')

  const changeView = (nextView) => {
    if (nextView === 'findPassword') setRecoveryUserId(loginData.userId)
    setView(nextView)
    setLoginErrors({})
    setLoginNotice('')
    setRecoveryErrors({})
    setRecoveryNotice('')
    setFindIdError('')
  }

  const handleLoginChange = ({ target: { name, value } }) => {
    setLoginData((current) => ({ ...current, [name]: value }))
    setLoginErrors((current) => ({ ...current, [name]: undefined }))
    setLoginNotice('')
  }

  const handleLoginSubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!loginData.userId.trim()) nextErrors.userId = '아이디를 입력해주세요.'
    if (!loginData.password) nextErrors.password = '비밀번호를 입력해주세요.'
    setLoginErrors(nextErrors)
    setLoginNotice('')
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus()
      return
    }

    // 실제 인증 API가 연결되면 이 위치에서 요청하고 서버 응답에 따라 이동합니다.
    setLoginNotice('로그인 인증은 준비 중입니다. 아직 계정에 로그인되지 않았습니다.')
  }

  const handleRecoverySubmit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!recoveryUserId.trim()) nextErrors.userId = '아이디를 입력해주세요.'
    if (!securityAnswer.trim()) nextErrors.securityAnswer = '힌트 답변을 입력해주세요.'
    setRecoveryErrors(nextErrors)
    setRecoveryNotice('')
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(nextErrors.userId ? 'recoveryUserId' : 'securityAnswer')?.focus()
      return
    }
    setRecoveryNotice('계정 찾기 인증은 준비 중입니다. 서버에서 답변을 확인하지 않았습니다.')
  }

  const handleFindIdSubmit = (event) => {
    event.preventDefault()
    const email = findIdEmail.trim()
    if (!email) setFindIdError('이메일을 입력해주세요.')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setFindIdError('올바른 이메일 형식으로 입력해주세요.')
    else {
      setFindIdError('')
      setRecoveryNotice('아이디 찾기는 준비 중입니다. 아직 서버에 조회하지 않았습니다.')
      return
    }
    setRecoveryNotice('')
    document.getElementById('findIdEmail')?.focus()
  }

  return (
    <main className="login-page">
      <header className="login-header account-header">
        <div className="account-header-inner">
          <a className="login-logo-link account-header-logo" href="/" onClick={handlePageLink('/')}
            aria-label="OLIGO-K 홈으로 이동">
            <img className="login-logo account-logo theme-logo theme-logo--night" src={nightLogo} alt="OLIGO-K" />
            <img className="login-logo account-logo theme-logo theme-logo--day" src={dayLogo} alt="OLIGO-K" />
          </a>
        </div>
      </header>
      <section className="login-content" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card-heading">
            <h1 id="login-title">
              {view === 'login' && '로그인'}
              {view === 'findPassword' && '비밀번호 찾기'}
              {view === 'findId' && '아이디 찾기'}
            </h1>
            <p>
              {view === 'login' && 'OLIGO-K와 함께 지역의 가능성을 올려보세요!'}
              {view === 'findPassword' && '회원가입 당시 설정한 힌트로 본인을 확인합니다.'}
              {view === 'findId' && '회원가입 시 입력하신 이메일 주소를 기재해주세요!'}
            </p>
          </div>

          {view === 'login' && (
            <form className="login-form" onSubmit={handleLoginSubmit} noValidate>
              <div className="login-field">
                <label htmlFor="userId"><UserRound size={17} />아이디 <b>필수</b></label>
                <input id="userId" name="userId" type="text" autoComplete="username"
                  value={loginData.userId} onChange={handleLoginChange}
                  placeholder="아이디를 입력해주세요" required aria-invalid={Boolean(loginErrors.userId)}
                  aria-describedby={loginErrors.userId ? 'userId-error' : undefined} />
                {loginErrors.userId && (
                  <small className="login-error" id="userId-error" role="alert">{loginErrors.userId}</small>
                )}
              </div>
              <div className="login-field">
                <label htmlFor="password"><LockKeyhole size={17} />비밀번호 <b>필수</b></label>
                <input id="password" name="password" type="password" autoComplete="current-password"
                  value={loginData.password} onChange={handleLoginChange}
                  placeholder="비밀번호를 입력해주세요" required aria-invalid={Boolean(loginErrors.password)}
                  aria-describedby={loginErrors.password ? 'password-error' : undefined} />
                {loginErrors.password && (
                  <small className="login-error" id="password-error" role="alert">{loginErrors.password}</small>
                )}
              </div>
              <div className="login-help-links" aria-label="계정 찾기">
                <button type="button" onClick={() => changeView('findPassword')}>비밀번호를 잊어버리셨나요?</button>
                <button type="button" onClick={() => changeView('findId')}>아이디를 잊어버리셨나요?</button>
              </div>
              <button className="login-submit" type="submit">로그인</button>
              {loginNotice && <p className="login-notice" role="status">{loginNotice}</p>}
              <p className="login-signup-prompt">
                아직 계정이 없으신가요?{' '}
                <a href="/signup" onClick={handlePageLink('/signup')}>회원가입</a>
              </p>
            </form>
          )}

          {view === 'findPassword' && (
            <form className="login-form login-recovery" onSubmit={handleRecoverySubmit} noValidate>
              <div className="login-field">
                <label htmlFor="recoveryUserId"><UserRound size={17} />아이디 <b>필수</b></label>
                <input id="recoveryUserId" type="text" autoComplete="username" value={recoveryUserId}
                  onChange={(event) => { setRecoveryUserId(event.target.value); setRecoveryErrors({}); setRecoveryNotice('') }}
                  placeholder="아이디를 입력해주세요" required aria-invalid={Boolean(recoveryErrors.userId)}
                  aria-describedby={recoveryErrors.userId ? 'recoveryUserId-error' : undefined} />
                {recoveryErrors.userId && (
                  <small className="login-error" id="recoveryUserId-error" role="alert">{recoveryErrors.userId}</small>
                )}
              </div>
              <button className="login-secondary-action" type="button"
                onClick={() => setRecoveryNotice('힌트 질문 조회는 인증 API 연결 후 이용할 수 있습니다.')}>
                힌트 질문 확인
              </button>
              <div className="login-question-panel" aria-live="polite">
                <span><KeyRound size={16} />힌트 질문</span>
                <p>회원가입 당시 설정한 질문이 표시될 영역</p>
              </div>
              <div className="login-field">
                <label htmlFor="securityAnswer"><LockKeyhole size={17} />힌트 답변 <b>필수</b></label>
                <input id="securityAnswer" type="text" value={securityAnswer}
                  onChange={(event) => { setSecurityAnswer(event.target.value); setRecoveryErrors({}); setRecoveryNotice('') }}
                  placeholder="답변을 입력해주세요" required aria-invalid={Boolean(recoveryErrors.securityAnswer)}
                  aria-describedby={recoveryErrors.securityAnswer ? 'securityAnswer-error' : undefined} />
                {recoveryErrors.securityAnswer && (
                  <small className="login-error" id="securityAnswer-error" role="alert">
                    {recoveryErrors.securityAnswer}
                  </small>
                )}
              </div>
              <button className="login-submit" type="submit">답변 확인</button>
              {recoveryNotice && <p className="login-notice" role="status">{recoveryNotice}</p>}
              <button className="login-back-button" type="button" onClick={() => changeView('login')}>
                로그인으로 돌아가기
              </button>
            </form>
          )}

          {view === 'findId' && (
            <form className="login-form login-recovery" onSubmit={handleFindIdSubmit} noValidate>
              <div className="login-field">
                <label htmlFor="findIdEmail"><Mail size={17} />이메일 <b>필수</b></label>
                <input id="findIdEmail" type="email" autoComplete="email" value={findIdEmail}
                  onChange={(event) => { setFindIdEmail(event.target.value); setFindIdError(''); setRecoveryNotice('') }}
                  placeholder="example@email.com" required aria-invalid={Boolean(findIdError)}
                  aria-describedby={findIdError ? 'findIdEmail-error' : undefined} />
                {findIdError && <small className="login-error" id="findIdEmail-error" role="alert">{findIdError}</small>}
              </div>
              <button className="login-submit" type="submit">아이디 찾기</button>
              {recoveryNotice && <p className="login-notice" role="status">{recoveryNotice}</p>}
              <button className="login-back-button" type="button" onClick={() => changeView('login')}>
                로그인으로 돌아가기
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
