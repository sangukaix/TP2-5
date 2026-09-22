import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, CircleHelp, Coins, Layers3, LoaderCircle, Sparkles } from 'lucide-react'
import WorkspaceShell from '../components/WorkspaceShell'
import RegionWorkspacePicker from '../components/RegionWorkspacePicker'
import PlanningBriefSummary from '../features/planning/PlanningBriefSummary'
import ByokConnectionPanel from '../components/ByokConnectionPanel'
import { useByokConnection } from '../features/byok/useByokConnection'
import { BUSINESS_DIRECTIONS, RESOURCE_OPTIONS, CONTEXT_OPTIONS, simplifiedDraft, nextThreeMonthSchedule, savePlanningDraft, validatePlanningBrief } from '../features/planning/planningBrief'
import { readActiveStrategyJob, saveActiveStrategyJob, useWorkspaceRegionData } from './tourismWorkspace'
import { getStrategyGenerationReadiness, startAiStrategyReportJob } from '../api/dashboardApi'
import { strategyJobUrl } from '../features/planning/strategyJobLink'
import '../App.css'
import '../features/planning/planning.css'

// ‘미정/입력하기’처럼 서로 하나만 선택하는 버튼 그룹입니다.
// radio input 대신 버튼과 aria-pressed를 사용해 현재 선택을 더 분명하게 표시합니다.
function Choice({ label, value, options, onChange }) {
  return <div className="planning-choice" role="group" aria-label={label}>{options.map(([key, text]) =>
    <button key={key} type="button" aria-pressed={value === key} className={value === key ? 'is-selected' : ''} onClick={() => onChange(key)}>{value === key && <Check size={13} />}{key === 'spend_conversion' ? <span>지역 소비<br />환급</span> : text}</button>
  )}</div>
}
function MultiChoice({ label, options, value = [], onChange }) {
  return <div className="planning-options" role="group" aria-label={label}>{options.map(([key, text]) =>
    <label className="planning-check" key={key}><input type="checkbox" checked={value.includes(key)} onChange={(event) => onChange(event.target.checked ? [...value, key] : value.filter((item) => item !== key))} />{text}</label>
  )}</div>
}
// 네 개의 사업 여건 카드가 같은 제목·도움말·아이콘 구조를 쓰도록 만든 공통 레이아웃입니다.
function Section({ number, icon: Icon, title, why, children }) {
  return <section className="planning-section"><header><span className="planning-section-icon"><Icon size={18} /></span><div><span className="planning-section-number">{number}</span><h2>{title}</h2></div><span className="planning-help" tabIndex="0" aria-label={why}><CircleHelp size={16} /><span>{why}</span></span></header>{children}</section>
}

function ByokKeyModal({ connection, onClose }) {
  const inputRef = useRef(null)
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !connection.busy) onClose() }
    window.addEventListener('keydown', closeOnEscape)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [connection.busy, onClose])

  const save = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (await connection.connect()) onClose()
  }
  const cancel = () => {
    if (connection.busy) return
    connection.setApiKey('')
    connection.clearMessage()
    onClose()
  }

  return createPortal(<div className="byok-key-modal-backdrop" role="presentation" onMouseDown={cancel}>
    <section className="byok-key-modal" role="dialog" aria-modal="true" aria-labelledby="byok-key-modal-title"
      onMouseDown={(event) => event.stopPropagation()}>
      <header><p>OpenAI BYOK 연결</p><h2 id="byok-key-modal-title">OpenAI API Key를 정확히 입력해주세요!</h2></header>
      <form onSubmit={save}>
        <label htmlFor="byok-key-modal-input">OpenAI API Key</label>
        <input ref={inputRef} id="byok-key-modal-input" type="password" autoComplete="off" value={connection.apiKey}
          onChange={(event) => connection.setApiKey(event.target.value)} placeholder="API Key 입력" />
        <p>입력한 Key는 AI 기능 수행 중 서버 메모리에서만 일시적으로 사용되며, 120분이 지나면 서버 메모리에서도 자동 삭제됩니다!</p>
        {connection.message && <small role="alert">{connection.message}</small>}
        <footer><button type="button" onClick={cancel} disabled={connection.busy}>취소</button><button type="submit"
          disabled={connection.busy}>{connection.busy ? '연결 중…' : '저장'}</button></footer>
      </form>
    </section>
  </div>, document.body)
}

function PlanningForm({ region, regions, dataState, byokConnection, onRegionChange, onDirtyChange }) {
  // 입력 초안은 지역 코드별 localStorage에서 복원합니다.
  // 단, 첨부 문서 본문은 브라우저에 저장하지 않고 생성 요청 시에만 사용합니다.
  const [brief, setBrief] = useState(() => simplifiedDraft(region.code))
  useEffect(() => {
    const refresh = () => setBrief((current) => {
      const schedule = nextThreeMonthSchedule()
      return current.start_date === schedule.start_date ? current : { ...current, ...schedule }
    })
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [freshness, setFreshness] = useState({ status: 'loading', can_generate: false, message: '최신 분석 데이터를 확인하고 있습니다.' })
  const [showByokModal, setShowByokModal] = useState(false)
  const submitting = useRef(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    onDirtyChange(dirty)
    if (!dirty) return undefined
    const guard = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, onDirtyChange])
  const activeJob = readActiveStrategyJob(region.code)
  // 생성만 보호하고, 대시보드·저장 기획안 조회에는 영향을 주지 않는 서버 최신성 계약입니다.
  useEffect(() => {
    let active = true
    getStrategyGenerationReadiness(region.code, region.name)
      .then((result) => { if (active) setFreshness(result?.data_freshness || { status: 'unavailable', can_generate: false, message: '데이터 최신성 정보를 받지 못했습니다.' }) })
      .catch((requestError) => { if (active) setFreshness({ status: 'unavailable', can_generate: false, message: requestError.message }) })
    return () => { active = false }
  }, [region.code, region.name])
  // 모든 입력 변경은 한 함수로 모아 저장 전 경고(dirty 상태)와 안내 문구를 일관되게 갱신합니다.
  const update = (changes) => { setBrief((current) => ({ ...current, ...changes })); setDirty(true); setError('') }
  // 내부 초안 보존은 생성 직전과 Strategy 복원에 쓰이므로 수동 버튼 없이 유지합니다.
  const persistPlanningDraft = () => {
    try {
      savePlanningDraft({ ...brief, ...nextThreeMonthSchedule() })
      setDirty(false)
      setError('')
      return true
    } catch {
      setError('이 브라우저에 입력 조건을 저장할 수 없습니다. 저장 공간과 브라우저 설정을 확인해 주세요.')
      return false
    }
  }
  // 생성 버튼은 장시간 걸리는 AI 작업을 서버에 등록한 뒤 /strategy로 이동합니다.
  // 중복 클릭은 submitting ref로 막고, 실제 진행 상태는 작업 ID로 복원합니다.
  const generate = async (event) => {
    event.preventDefault()
    if (!activeJob && !freshness.can_generate) { setError(freshness.message); return }
    const problem = validatePlanningBrief(brief)
    if (!activeJob && problem) { setError(problem); return }
    if (!activeJob) {
      try {
        const byokStatus = await byokConnection.refresh()
        if (byokStatus.capability.requires_user_api_key && !byokStatus.session.connected) {
          setError('')
          byokConnection.clearMessage()
          setShowByokModal(true)
          return
        }
      } catch (requestError) {
        setError(requestError.message)
        return
      }
    }
    if (submitting.current || !persistPlanningDraft()) return
    submitting.current = true; setBusy(true)
    try {
      if (activeJob) { window.location.assign(strategyJobUrl(activeJob, region.name)); return }
      // 입력한 조건의 복사본이 서버 작업에 전달됩니다. 작성 중 초안은 별도입니다.
      const started_at = new Date().toISOString()
      const job = { ...await startAiStrategyReportJob(region.code, { region_name: region.name, planning_brief: { ...brief, ...nextThreeMonthSchedule() } }), started_at }
      // 작업 ID만 브라우저에 남기고, 첨부 문서 본문은 서버 작업 중에만 사용합니다.
      saveActiveStrategyJob(job)
      window.location.assign(strategyJobUrl(job, region.name))
    } catch (requestError) { setError(requestError.message); submitting.current = false; setBusy(false) }
  }
  // 화면에서는 쉼표가 있는 금액도 허용하지만, 저장 값은 계산 가능한 정수 원 단위로 정규화합니다.
  const amountChange = (field, raw) => update({ [field]: raw.replace(/\D/g, '') ? Number(raw.replace(/\D/g, '')) : null })
  return <form className="planning-layout" onSubmit={generate}>
    <header className="work-page-header">
      <div><h1>{region.name}</h1></div>
      <RegionWorkspacePicker region={region} regions={regions} label="분석지역 변경" onChange={onRegionChange} />
    </header>
    <div className="planning-fields">
      <fieldset disabled={busy} className="planning-fieldset">
        <Section number="01" icon={Sparkles} title="사업 방향" why="공식 사례가 확보된 사업 유형 안에서 비교합니다.">
          <Choice label="사업 방향" value={brief.business_direction} options={BUSINESS_DIRECTIONS} onChange={(business_direction) => update({ business_direction })} />
          <p className="planning-hint">관광사업 아이디어를 제안합니다. 신축 건물·공원 등 시설 개발 계획은 지원하지 않습니다. KPI는 근거와 함께 제안하며 생성 후 조정할 수 있습니다.</p>
        </Section>
        <Section number="02" icon={Coins} title="참고 예산" why="예산 배분 예시이며 실행 가능성과 사업 효과를 보장하는 금액은 아닙니다.">
          <Choice label="예산 상태" value={brief.budget_status} options={[['unknown', '미정'], ['indicative', '참고 총액 입력']]} onChange={(budget_status) => update({ budget_status, budget_max_krw: null })} />
          {brief.budget_status !== 'unknown' && <label>참고 예산 총액<div className="planning-money"><input aria-label="참고 예산 총액" inputMode="numeric" value={brief.budget_max_krw?.toLocaleString('ko-KR') || ''} onChange={(e) => amountChange('budget_max_krw', e.target.value)} placeholder="예: 30,000,000" /><span>원</span></div></label>}
          <p className="planning-hint">입력 금액은 견적 예시의 항목별 배분에 반영합니다. 사업 규모·인력·KPI가 이 금액으로 달성된다는 뜻은 아닙니다.</p>
        </Section>
        <Section number="03" icon={Layers3} title="활용할 자원" why="사업 설계에 참고할 자원을 복수 선택하세요. 선택 내용은 공식 확인 사실과 구분합니다.">
          <MultiChoice label="활용할 자원" options={RESOURCE_OPTIONS} value={brief.resource_options} onChange={(resource_options) => update({ resource_options })} />
          <p className="planning-hint">선택 사항 · 활용을 검토할 자원만 고르세요. 선택하지 않아도 생성할 수 있습니다.</p>
        </Section>
        <Section number="04" icon={Layers3} title="현장 정보와 선호" why="방문 대상과 운영 방향을 참고합니다. 관측값이나 ML 예측은 바꾸지 않습니다.">
          <MultiChoice label="현장 정보와 선호" options={CONTEXT_OPTIONS} value={brief.context_options} onChange={(context_options) => update({ context_options })} />
          <p className="planning-hint">선택 사항 · 대상 방문객과 연계 방식을 복수 선택할 수 있습니다.</p>
        </Section>
      </fieldset>
       {(error || dirty || dataState === 'error' || byokConnection.capability?.requires_user_api_key) && <div className="planning-inline-status" aria-live="polite">{byokConnection.capability?.requires_user_api_key && <p className={`planning-byok-required${byokConnection.session?.connected ? ' is-connected' : ''}`}>{byokConnection.session?.connected ? 'OpenAI API Key 가 정상적으로 연결되었습니다. 기획안 AI생성을 시작하세요!' : '기획안 AI 생성을 시작하려면 OpenAI API Key를 연결해주세요.'}</p>}{error ? <p role="alert" className="planning-error">{error}</p> : dirty && <p>저장하지 않은 변경사항이 있습니다.</p>}
        {dataState === 'error' && <p className="planning-error">지역 원자료를 불러오지 못했습니다. 서버 연결을 확인해 주세요.</p>}</div>}
    </div>
    <aside className="planning-summary-column"><PlanningBriefSummary brief={brief} regionName={region.name} title="아래 조건으로 기획안 생성" />
      <ByokConnectionPanel connection={byokConnection} />
      <button type="submit" disabled={!activeJob && (busy || dataState !== 'ready' || !freshness.can_generate)} className="planning-primary planning-summary-generate">{busy ? <LoaderCircle className="planning-spinner" size={16} /> : <Sparkles size={16} />}{busy ? '생성 요청 중…' : activeJob ? '생성 중인 기획안 보기' : freshness.status === 'loading' ? '데이터 확인 중…' : freshness.can_generate ? '기획안 생성' : '데이터 업데이트 후 생성'}<ArrowRight size={16} /></button></aside>
    {showByokModal && <ByokKeyModal connection={byokConnection} onClose={() => setShowByokModal(false)} />}
  </form>
}

export default function TourismPlanningPage() {
  const { region, regions, chooseRegion, state } = useWorkspaceRegionData()
  const [dirty, setDirty] = useState(false)
  const byokConnection = useByokConnection()
  // 다른 지역으로 바꾸기 전, 아직 저장하지 않은 사업 여건이 있으면 한 번 확인합니다.
  const changeRegion = (code) => {
    if (code === region.code) return
    if (dirty && !window.confirm('저장하지 않은 변경사항이 있습니다. 저장하지 않고 지역을 변경할까요?')) return
    setDirty(false); chooseRegion(code)
  }
  return <WorkspaceShell>
    <main className="tourism-work-page planning-page">
      <PlanningForm
        key={region.code}
        region={region}
        regions={regions}
        dataState={state}
        byokConnection={byokConnection}
        onRegionChange={changeRegion}
        onDirtyChange={setDirty}
      />
    </main>
  </WorkspaceShell>
}
