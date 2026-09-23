import { KeyRound, Link2, LogOut } from 'lucide-react'
import { useByokConnection } from '../features/byok/useByokConnection'

function ByokConnectionPanelView({ compact, connection }) {
  const { apiKey, busy, capability, connect, disconnect, message, session, setApiKey } = connection
  if (!capability?.requires_user_api_key) return null

  const submit = async (event) => {
    event.preventDefault()
    await connect()
  }

  return <section className={`byok-connection${compact ? ' is-compact' : ''}`} aria-live="polite">
    <header><KeyRound size={16} /><strong>OpenAI API 연결</strong><span>{session?.connected ? '연결됨' : '연결 필요'}</span></header>
    {session?.connected ? <div className="byok-connected"><p>AI 생성·수정은 연결된 사용자 API Key로만 실행됩니다.</p><button type="button" onClick={disconnect} disabled={busy}><LogOut size={14} />연결 해제</button></div> : <form onSubmit={submit}>
      <label>OpenAI API Key<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="API Key 입력" /></label>
      <button type="submit" disabled={busy}><Link2 size={14} />{busy ? '연결 중…' : 'OpenAI 연결'}</button>
      <p>AI 기능 수행 중 서버 메모리에서만 일시적으로 사용되며, DB와 브라우저 저장소에는 저장하지 않습니다. OLIGO-K 전용 OpenAI Project API Key 사용을 권장합니다.</p>
    </form>}
    {message && <small className="byok-message">{message}</small>}
  </section>
}

function ManagedByokConnectionPanel({ onChange, compact }) {
  const connection = useByokConnection(onChange)
  return <ByokConnectionPanelView compact={compact} connection={connection} />
}

/** 외부 connection을 받으면 Modal과 동일한 transient Key/session 상태를 공유합니다. */
export default function ByokConnectionPanel({ connection, onChange, compact = false }) {
  if (connection) return <ByokConnectionPanelView compact={compact} connection={connection} />
  return <ManagedByokConnectionPanel compact={compact} onChange={onChange} />
}
