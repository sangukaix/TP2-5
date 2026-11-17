import { useState } from 'react'
import { acceptsDemoLogin } from '../demoProfile'

export default function DemoLogin({ onLogin, onCancel }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  return <form className="oligo-world-demo-login" onSubmit={event => {
    event.preventDefault()
    if (acceptsDemoLogin(username.trim(), password)) onLogin()
    else setError('아이디 또는 비밀번호가 올바르지 않습니다.')
  }}>
    <h2>Oligo World 체험 로그인</h2>
    <p>임시 체험 모드입니다. 진행 기록은 새로고침하면 초기화됩니다.</p>
    <label htmlFor="oligo-demo-id">아이디</label>
    <input id="oligo-demo-id" value={username} autoComplete="off" required
      onChange={event => setUsername(event.target.value)} />
    <label htmlFor="oligo-demo-password">패스워드</label>
    <input id="oligo-demo-password" type="password" value={password} autoComplete="off" required
      onChange={event => setPassword(event.target.value)} />
    {error && <p role="alert">{error}</p>}
    <button className="oligo-world-status" type="submit">로그인</button>
    <button className="oligo-world-status" type="button" onClick={onCancel}>취소</button>
    <a className="oligo-world-guest-hub" href="/login">회원 계정으로 로그인</a>
  </form>
}
