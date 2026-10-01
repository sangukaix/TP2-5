import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Bot, CheckCircle2, CircleDotDashed, DatabaseZap, RefreshCw, Save, ServerCog, ShieldAlert } from 'lucide-react'
import '../../App.css'
import WorkspaceShell from '../../components/WorkspaceShell'
import LearningSectionNav from './LearningSectionNav'
import { getLlmConfig, getLlmOverview, getLlmStatus, getLlmTrace, resetLlmConfig, saveLlmConfig } from '../../api/llmControlApi'
import './mlTest.css'
import './LlmControlPage.css'
import { ProjectTutor } from './LearningArchitecturePage'

const LABELS = {
  evidence: '지역 근거 조사', case_study: '공식 사례 조사', local_web_query_planner: '무료 공식 검색 질문 설계', transferability: '지역 적합성 판단',
  planner: '기획안 초안 작성', planner_revision: '기획안 보완', reviewer: '1차 품질 검수',
  final_reviewer: '최종 품질 검수', chat_explain: '챗봇 설명', chat_research: '챗봇 공식 조사', chat_revise: '챗봇 수정',
}

const TOOL_LABELS = {
  get_region_metrics: '지역 관측값', compare_regions: '타 지역 비교', get_ml_forecast: 'ML 전망·검증',
  get_planning_decision: '후보 선정 근거', get_case_comparison_matrix: '사례 운영원리 비교', search_collected_sources: '수집 자료 검색',
  read_collected_source: '사례·출처 읽기', read_task_section: '세부 근거 읽기',
}

/** 연결 상태와 실제 추론은 다릅니다. 실패·도구 조회·유료 폴백을 숨기지 않습니다. */
function TraceEvent({ event }) {
  const blocked = event.provider_called === false || event.status === 'blocked'
  const failed = event.status === 'failed' || blocked
  const prepared = event.input_preparation
  return <article className={failed ? 'llm-trace-failed' : ''}>
    <b>{LABELS[event.stage] || event.stage} · {blocked ? '호출 차단' : failed ? '실패' : event.status === 'completed' ? '완료' : '상태 미확인'}</b>
    <span>{event.provider} · {event.model}</span>
    <em>{event.duration_ms?.toLocaleString()} ms</em>
    {event.fallback && <i>대체 실행: {event.requested_provider} → {event.provider}</i>}
    <small>{failed ? `결과 미채택 · ${event.error_code || event.fallback_reason || '오류 확인 필요'}`
      : event.web_search_used ? 'OpenAI Web Search 사용' : '구조화 JSON 출력 · 웹검색 실행 아님'}</small>
    {event.tool_trace?.length > 0 && <small>근거 도구: {event.tool_trace.map((tool) =>
      `${TOOL_LABELS[tool.tool] || tool.tool} (${tool.status === 'completed' ? '조회' : '자료 미확보'})`).join(' · ')}</small>}
    {prepared && <small>원본은 요청 안에 보존 · 출처 {prepared.sources_available}건 중 원문 조회 {prepared.sources_read}건</small>}
    {event.fallback && <small>대체 실행 사유: {event.fallback_reason}</small>}
    {event.paid_reason && <small>{blocked ? '차단 사유' : 'OpenAI 사용 사유'}: {event.paid_reason}</small>}
  </article>
}

/** 실제 서버 상태와 저장된 라우팅을 보여 주는 팀 내부 운영·학습 화면입니다. */
export default function LlmControlPage() {
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState(null)
  const [trace, setTrace] = useState([])
  const [usage, setUsage] = useState(null)
  const [adminToken, setAdminToken] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const dirty = useRef(false)
  const editVersion = useRef(0)
  const [hasEdits, setHasEdits] = useState(false)
  const refreshing = useRef(false)
  const alive = useRef(true)
  const [checking, setChecking] = useState(false)
  const refresh = useCallback(async () => {
    if (refreshing.current) return
    refreshing.current = true
    const version = editVersion.current
    try {
      const [nextStatus, nextConfig, tracePayload] = await Promise.all([getLlmOverview(), getLlmConfig(), getLlmTrace()])
      if (!alive.current) return
      setStatus((previous) => ({ ...nextStatus, providers: previous?.providers || [] }))
      if (!dirty.current && version === editVersion.current) setConfig(nextConfig)
      setTrace(tracePayload.events || []); setUsage(tracePayload.usage || null)
    } catch (error) { if (alive.current) setMessage(error.message) }
    finally { refreshing.current = false }
  }, [])
  useEffect(() => {
    alive.current = true
    const initial = window.setTimeout(refresh, 0)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 15000)
    return () => { alive.current = false; window.clearTimeout(initial); window.clearInterval(timer) }
  }, [refresh])
  const editConfig = (next) => { dirty.current = true; editVersion.current += 1; setHasEdits(true); setConfig(next) }
  const changeRoute = (task, field, value) => { dirty.current = true; editVersion.current += 1; setHasEdits(true); setConfig((current) => ({ ...current, routes: { ...current.routes, [task]: { ...current.routes[task], [field]: value } } })) }
  const save = async () => {
    setBusy(true)
    try {
      const saved = await saveLlmConfig(config, adminToken)
      dirty.current = false; editVersion.current += 1; setHasEdits(false); setConfig(saved); setAdminToken('')
      setMessage('저장했습니다. 다음 생성 요청부터 적용됩니다. 진행 중인 생성은 기존 설정을 유지합니다.')
      await refresh()
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  const restore = async () => {
    setBusy(true)
    try {
      const saved = await resetLlmConfig(adminToken)
      dirty.current = false; editVersion.current += 1; setHasEdits(false); setConfig(saved); setAdminToken('')
      setMessage('서버 환경변수의 기본 라우팅으로 복구했습니다.'); await refresh()
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  const checkConnection = async () => {
    setChecking(true)
    try { const next = await getLlmStatus(); if (alive.current) setStatus(next) }
    catch (error) { if (alive.current) setMessage(error.message) }
    finally { if (alive.current) setChecking(false) }
  }
  return <WorkspaceShell><main className="ml-test-page llm-control-page admin-study-page"><LearningSectionNav /><div className="learning-architecture-layout"><div className="learning-architecture-content">
    <header className="llm-control-heading"><h1>AI Router</h1><div><button type="button" onClick={refresh} disabled={busy}><RefreshCw size={15} />새로고침</button><button type="button" disabled={checking} onClick={checkConnection}>{checking ? '연결 확인 중…' : '모델 연결 확인'}</button></div></header>
    {message && <p className="llm-control-feedback" role="status"><AlertCircle size={14} />{message}</p>}
    {status?.providers?.length > 0 && <section className="llm-provider-grid">{status.providers.map((provider) => { const role = provider.role || provider.provider; const label = role === 'openai' ? 'OpenAI' : role === 'qwen' ? 'Qwen · Ollama' : 'Gemma · Ollama'; return <article key={role} className={`is-${provider.status}`}><header><ServerCog size={18} /><div><b>{label}</b><span>{provider.message}</span></div><em>{provider.status === 'active' ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}{provider.status}</em></header><p>{provider.models?.join(' · ') || '모델 목록 확인 필요'}</p><footer>{provider.capabilities?.map((item) => <i key={item}>{item}</i>)}</footer></article> })}</section>}
    {hasEdits && <p className="llm-control-feedback" role="status">저장하지 않은 설정이 있습니다.</p>}
    {config && <section className="llm-routing-panel">
      <header><div><Bot size={19} /><div><h2>작업별 라우팅</h2><p>저장 후 실제 적용 경로를 표시합니다. 설정 변경에는 관리자 토큰이 필요합니다.</p></div></div>
        <label>모드<select value={config.mode} disabled={busy} onChange={(event) => editConfig({ ...config, mode: event.target.value })}>
          <option value="student_budget">student_budget · 학생 절약 (OpenAI 최종 검수 1회)</option><option value="local_first">local_first · 로컬 우선</option><option value="local_first_gemma">로컬우선(Gemma)</option><option value="hybrid">hybrid · 유료 대체 허용</option><option value="openai_only">openai_only</option><option value="local_only">local_only · 웹검색 불가</option>
        </select></label></header>
      <div className="llm-routing-table"><div className="llm-routing-row is-head"><span>작업</span><span>Provider</span><span>모델</span><span>폴백</span></div>
        {Object.entries(config.routes).map(([task, route]) => {
          const applied = config.mode === status?.mode
          const locked = applied ? status?.capability_locks?.[task] : '모드 저장 후 실제 경로 확인'
          const shown = applied && locked ? (status?.effective_routes?.[task] || route) : route
          return <div className="llm-routing-row" key={task}>
            <b>{LABELS[task] || task}{locked && <small>{locked}</small>}</b>
            <select value={shown.provider} disabled={busy || Boolean(locked)} onChange={(event) => changeRoute(task, 'provider', event.target.value)}>
              <option value="openai">OpenAI</option><option value="qwen">Qwen</option><option value="gemma">Gemma</option><option value="local_sources">저장된 공식 근거</option><option value="unavailable">실행 불가</option>
            </select>
            <input value={shown.model || ''} disabled={busy || Boolean(locked)} placeholder="환경변수 기본 모델" onChange={(event) => changeRoute(task, 'model', event.target.value)} />
            <select value={shown.fallback} disabled={busy || Boolean(locked)} onChange={(event) => changeRoute(task, 'fallback', event.target.value)}><option value="none">없음</option><option value="openai">OpenAI</option></select>
          </div>
        })}
      </div>
      <footer><input type="password" value={adminToken} onChange={(event) => setAdminToken(event.target.value)} placeholder="LLM 관리자 토큰 (저장하지 않음)" /><button type="button" disabled={busy} onClick={restore}>기본값 복구</button><button type="button" disabled={busy} onClick={save}><Save size={14} />설정 저장</button></footer>
    </section>}
    <section className="llm-trace-panel"><header><div><CircleDotDashed size={18} /><div><h2>실시간 실행 기록</h2><p>시도별 성공·실패·대체 실행을 표시합니다. 근거 조회는 이번 요청의 수집 자료 대상이며, 실시간 웹검색과 구분합니다.</p></div></div>{usage && <span><DatabaseZap size={14} />실행 시도 {usage.tracked_calls}회 · 확인된 토큰 {(usage.total_tokens || 0).toLocaleString()}<small>사용량 미확인 {usage.usage_unknown_attempts ?? 0}회 · 비용은 별도 검증 필요</small></span>}</header><div>{trace.length === 0 ? <p className="llm-empty">아직 이 AI Server에서 실행된 LLM 호출이 없습니다.</p> : trace.map((event, index) => <TraceEvent key={`${event.recorded_at}-${index}`} event={event} />)}</div></section>
  </div><ProjectTutor topic="openai" checkConnection={false} /></div></main></WorkspaceShell>
}
