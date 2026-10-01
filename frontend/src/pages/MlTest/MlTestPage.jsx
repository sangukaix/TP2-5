import { useEffect, useRef, useState } from 'react'
import { AlertCircle, BarChart3, BookOpen, Bot, CheckCircle2, Database, LoaderCircle, Send, Sparkles } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import '../../App.css'
import { chatWithMlLearningAssistant, getMlLearningRegion, getMlLearningRegions } from '../../api/mlLearningApi'
import WorkspaceShell from '../../components/WorkspaceShell'
import LearningSectionNav from './LearningSectionNav'
import useLearningAssistantStatus from './useLearningAssistantStatus'
import './mlTest.css'

const GLOSSARY = [
  ['Feature', '모델이 예측에 참고하는 입력값'],
  ['Target', '모델이 맞히려는 결과값'],
  ['Lag', '1·3·12개월 전처럼 과거 시점의 값'],
  ['Baseline', '복잡한 모델과 비교하는 단순 기준모델'],
  ['MAE', '실제값과 예측값의 평균 절대 차이'],
  ['RMSE', '큰 오차에 더 큰 불이익을 주는 지표'],
  ['MAPE', '실제값 대비 평균 오차 비율'],
  ['재귀 예측', '앞 달 예측값을 다음 달 입력으로 다시 사용하는 방법'],
]

function formatMonth(value) {
  const text = String(value || '')
  return text.length === 6 ? `${text.slice(0, 4)}.${text.slice(4)}` : text
}

function formatValue(value, unit, compact = false) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  if (unit === '원') {
    if (compact) return `${(number / 100000000).toFixed(0)}억`
    return `${Math.round(number).toLocaleString()}원`
  }
  if (unit === '명') {
    if (compact) return `${(number / 10000).toFixed(0)}만`
    return `${Math.round(number).toLocaleString()}명`
  }
  if (unit === '일') return `${number.toFixed(2)}일`
  if (unit === '%') return `${number.toFixed(2)}%`
  if (unit === '분') return `${Math.round(number).toLocaleString()}분`
  if (unit === '건') {
    if (compact && number >= 10000) return `${(number / 10000).toFixed(0)}만`
    return `${Math.round(number).toLocaleString()}건`
  }
  return number.toLocaleString()
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : '-'
}

function MetricTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="ml-test-tooltip">
      <b>{formatMonth(label)}</b>
      {payload.map((item) => <span key={item.dataKey} style={{ color: item.color }}>{item.name}: {formatValue(item.value, unit)}</span>)}
    </div>
  )
}

/** 모든 예측 지표에 동일한 데이터·모델·평가·결과 구성을 적용합니다. */
function LearningModuleCard({ module, index }) {
  const chartData = module.forecast.map((point) => ({
    month: point.month,
    predicted: point.predicted,
    previous: point.previous_year_actual,
  }))
  const evaluation = module.evaluation || {}
  const baselineSelected = module.model_name === 'seasonal_naive_previous_year_same_month'

  return (
    <article className="ml-module-card">
      <header className="ml-module-heading">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div><p>예측 Target</p><h2>{module.title}</h2></div>
        <em>{baselineSelected ? '계절 기준모델' : module.model_name}</em>
      </header>

      <p className="ml-module-purpose">{module.purpose}</p>
      <div className="ml-module-main">
        <div className="ml-module-notes">
          <section>
            <h3><Database size={15} />사용 데이터</h3>
            <ul>{module.data_sources.map((source) => <li key={source}>{source}</li>)}</ul>
            <small>{module.open_api_usage}</small>
          </section>
          <section>
            <h3><BarChart3 size={15} />사용 모델</h3>
            <strong>{module.model_name}</strong>
            <p>{module.model_explanation}</p>
          </section>
        </div>

        <section className="ml-module-chart" aria-label={`${module.title} 차트`}>
          <div><b>3개월 예측 결과</b><span>전년 같은 달 관측값과 비교</span></div>
          <ResponsiveContainer width="100%" height={245}>
            <LineChart data={chartData} margin={{ top: 18, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="#e7edf4" vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis width={58} tickFormatter={(value) => formatValue(value, module.unit, true)} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<MetricTooltip unit={module.unit} />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Line type="monotone" dataKey="previous" name="전년 동월 실제" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="predicted" name="모델 예측" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="ml-module-evaluation">
        <h3>평가 결과</h3>
        <div className="ml-score-grid">
          <span><small>Test MAE</small><b>{formatValue(evaluation.test_mae, module.unit)}</b></span>
          <span><small>Test MAPE</small><b>{formatPercent(evaluation.test_mape_percent)}</b></span>
          <span><small>기준 MAPE</small><b>{formatPercent(evaluation.baseline_test_mape_percent)}</b></span>
        </div>
        <p className={evaluation.beats_baseline_on_test ? 'is-positive' : ''}>
          {baselineSelected
            ? 'Validation에서 전년 동월 기준모델을 선택했습니다.'
            : evaluation.beats_baseline_on_test
              ? '최종 Test에서 선택 모델의 오차가 기준모델보다 낮았습니다.'
              : '최종 Test에서 기준모델보다 개선되지 않았습니다.'}
        </p>
      </section>
      <footer><CheckCircle2 size={17} /><div><b>그래서 얻은 답</b><p>{module.conclusion}</p></div></footer>
    </article>
  )
}

const ML_CHAT_EXAMPLES = [
  '왜 방문자 수에는 RandomForest를 사용했어?',
  'Train·Validation·Test는 어떻게 나눴어?',
  '3개월과 6개월 예측은 정확도가 어떻게 달라?',
]

/** 현재 페이지의 실제 ML 카탈로그만 근거로 답하는 학습용 챗봇입니다. */
function MlChatPanel({ region }) {
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const messageEndRef = useRef(null)
  const { assistantStatus, markActive, markInactive } = useLearningAssistantStatus()
  const statusLabel = assistantStatus.status === 'active' ? 'Active' : assistantStatus.status === 'inactive' ? 'Inactive' : 'Checking'

  useEffect(() => { messageEndRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages, busy])

  const sendQuestion = async (text) => {
    const value = String(text || '').trim()
    if (!value || busy || region?.status !== 'available') return
    const history = messages.map((message) => ({ role: message.role, content: message.content })).slice(-6)
    setMessages((current) => [...current, { role: 'user', content: value }])
    setQuestion(''); setError(''); setBusy(true)
    try {
      const answer = await chatWithMlLearningAssistant(region.region_code, { question: value, history })
      setMessages((current) => [...current, {
        role: 'assistant', content: answer.answer, keyPoints: answer.key_points,
        modules: answer.related_modules, caution: answer.caution,
      }])
      markActive()
    } catch (requestError) { setError(requestError.message); markInactive(requestError) }
    finally { setBusy(false) }
  }

  return <aside className="ml-chat" aria-label="ML 챗봇">
    <header><span><Bot size={18} /></span><div><h2>ML 챗봇</h2><p>{region?.region_name || '선택 지역'} 모델 학습 도우미</p></div><i className={`assistant-status is-${assistantStatus.status}`} title={assistantStatus.message}><b />{statusLabel}</i></header>
    <div className="ml-chat-context"><Sparkles size={14} /><span>현재 페이지의 데이터·모델·함수·평가 결과를 근거로 답합니다.</span></div>
    <div className="ml-chat-messages" aria-live="polite">
      {messages.length === 0 && <div className="ml-chat-empty"><b>무엇이든 물어보세요</b><p>모델을 선택한 이유, Feature, MAE, 재귀 예측, 기획안 연결 방식까지 설명할 수 있습니다.</p><div>{ML_CHAT_EXAMPLES.map((example) => <button type="button" key={example} onClick={() => sendQuestion(example)}>{example}</button>)}</div></div>}
      {messages.map((message, index) => <article className={`ml-chat-message is-${message.role}`} key={`${message.role}-${index}`}>
        <small>{message.role === 'user' ? '나' : 'ML 챗봇'}</small><p>{message.content}</p>
        {message.keyPoints?.length > 0 && <ul>{message.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>}
        {message.modules?.length > 0 && <div className="ml-chat-tags">{message.modules.map((module) => <span key={module}>{module}</span>)}</div>}
        {message.caution && <em>{message.caution}</em>}
      </article>)}
      {busy && <div className="ml-chat-thinking"><LoaderCircle size={15} />모델 정보를 확인하고 있습니다.</div>}
      <div ref={messageEndRef} />
    </div>
    {error && <p className="ml-chat-error" role="alert"><AlertCircle size={13} />{error}</p>}
    <form className="ml-chat-composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(question) }}>
      <textarea rows="3" maxLength="2000" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="머신러닝에 대해 질문해 주세요." disabled={busy || region?.status !== 'available'} />
      <button type="submit" aria-label="질문 보내기" disabled={busy || !question.trim()}>{busy ? <LoaderCircle size={16} /> : <Send size={16} />}</button>
    </form>
    <footer>OpenAI가 답변하며, RAG와 웹 검색은 사용하지 않습니다.</footer>
  </aside>
}

/** 등록된 지역·모델 결과를 API에서 받아 자동으로 늘어나는 학습 전용 페이지입니다. */
export default function MlTestPage() {
  const [regionOptions, setRegionOptions] = useState([])
  const [region, setRegion] = useState(null)
  const [selectedCode, setSelectedCode] = useState('')
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingRegion, setLoadingRegion] = useState(false)
  const [error, setError] = useState('')
  const regionCache = useRef(new Map())

  useEffect(() => {
    const controller = new AbortController()
    getMlLearningRegions(controller.signal)
      .then((data) => {
        setRegionOptions(data.regions || [])
        setSelectedCode(data.regions?.[0]?.region_code || '')
      })
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoadingOptions(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedCode) return undefined
    const cached = regionCache.current.get(selectedCode)
    if (cached) {
      setRegion(cached)
      setError('')
      setLoadingRegion(false)
      return undefined
    }
    const controller = new AbortController()
    setRegion(null)
    setError('')
    setLoadingRegion(true)
    getMlLearningRegion(selectedCode, controller.signal)
      .then((data) => {
        regionCache.current.set(selectedCode, data)
        setRegion(data)
      })
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoadingRegion(false) })
    return () => controller.abort()
  }, [selectedCode])

  return (
    <WorkspaceShell>
      <main className="ml-test-page">
        <LearningSectionNav />
        <div className="ml-test-layout"><div className="ml-test-content">
        <header className="ml-test-hero">
          <div><p>STUDY PAGE</p><h1>머신러닝 결과</h1><span>지역별 3개월 예측과 모델 평가를 확인합니다.</span></div>
          {regionOptions.length > 0 && <label>분석 지역<select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}>
            {regionOptions.map((item) => <option key={item.region_code} value={item.region_code}>{item.region_name}</option>)}
          </select></label>}
        </header>

        {(loadingOptions || loadingRegion) && !error && <div className="ml-test-state">{loadingOptions ? '분석 지역 목록을 불러오고 있습니다.' : '선택 지역의 예측 결과를 불러오고 있습니다.'}</div>}
        {error && <div className="ml-test-state is-error"><AlertCircle size={18} />{error}</div>}
        {region?.status === 'unavailable' && <div className="ml-test-state is-error"><AlertCircle size={18} />{region.reason}</div>}

        {region?.status === 'available' && <>
          <section className="ml-overview">
            <div><small>학습 지역</small><b>{region.region_name}</b><span>{region.region_code}</span></div>
            <div><small>원자료 기간</small><b>{region.source_period}</b><span>{region.observation_count}개월</span></div>
            <div><small>데이터 분리</small><b>Train → Validation → Test</b><span>{region.train_period} / {region.validation_period} / {region.test_period}</span></div>
            <div><small>현재 결과 모듈</small><b>{region.modules.length}개</b><span>{region.model_version}</span></div>
          </section>

          <section className="ml-module-list">
            {region.modules.map((module, index) => <LearningModuleCard module={module} index={index} key={module.id} />)}
          </section>

          <section className="ml-glossary">
            <header><BookOpen size={19} /><div><h2>수업 용어 정리</h2><p>이 페이지에서 사용한 핵심 머신러닝 용어입니다.</p></div></header>
            <dl>{GLOSSARY.map(([term, meaning]) => <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl>
          </section>

          <p className="ml-auto-note">새 지역이나 예측 Target이 ML 등록정보에 추가되면 이 페이지의 지역 목록과 결과 카드도 자동으로 추가됩니다.</p>
        </>}
        </div><MlChatPanel key={selectedCode} region={region} /></div>
      </main>
    </WorkspaceShell>
  )
}
