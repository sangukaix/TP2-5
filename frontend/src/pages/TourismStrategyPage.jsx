import { CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import WorkspaceAssistantPanel from '../components/WorkspaceAssistantPanel'
import WorkspaceShell from '../components/WorkspaceShell'
import { WorkspaceConversationProvider } from '../components/WorkspaceConversationProvider'
import StrategyPresentationPreview from '../components/StrategyPresentationPreview'
import { cancelAiStrategyReportJob, downloadAiStrategyPresentation, downloadAiStrategyProposal, getAiStrategyReportJob, getStoredStrategyReport, getStoredStrategyReports, saveStoredStrategyReport } from '../api/dashboardApi'
import { clearActiveStrategyJob, downloadBlob, readActiveStrategyJob, readSavedReport, saveReport, useWorkspaceRegionData } from './tourismWorkspace'
import { readPlanningDraft } from '../features/planning/planningBrief'
import { applyReportPatch } from '../features/planning/applyReportPatch'
import { clearStrategyJobLink, readStrategyJobLink } from '../features/planning/strategyJobLink'
import StrategyJobWaitingNotice from '../features/planning/StrategyJobWaitingNotice'
import '../features/planning/planning.css'
import '../App.css'
import { createReportSaveQueue } from '../features/planning/reportSaveQueue'

const queueReportSave = createReportSaveQueue(saveStoredStrategyReport)

function cloneReport(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value
}

function reportFingerprint(value) {
  return JSON.stringify(value || null)
}

/** 생성된 기획안을 페이지 안에서 검토하고, AI 챗봇 수정 내용을 자동 저장하는 화면입니다. */
export default function TourismStrategyPage() {
  // 선택 지역과 해당 지역의 마지막 생성 작업을 여러 페이지에서 이어서 사용합니다.
  const { region } = useWorkspaceRegionData()
  const [report, setReport] = useState(null)
  const [activeJob, setActiveJob] = useState(readStrategyJobLink)
  const [jobProgress, setJobProgress] = useState(null)
  const [cancellingJob, setCancellingJob] = useState(false)
  const [downloadingFormat, setDownloadingFormat] = useState('')
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState({ state: 'idle' })
  const saveRevision = useRef(0)
  const pendingSave = useRef(null)
  const baselineReport = useRef(null)
  const baselineKey = useRef('')
  const editHistory = useRef([])
  const [historyDepth, setHistoryDepth] = useState(0)
  const [isModified, setIsModified] = useState(false)
  const persistedJob = readActiveStrategyJob(region.code)
  const currentJob = activeJob?.region_code === region.code ? activeJob : persistedJob
  const persistedReport = useMemo(() => readSavedReport(region.code), [region.code])
  const storedReport = report?.region_name === region.name ? report : persistedReport
  const displayReport = currentJob ? null : storedReport
  const strategy = displayReport?.strategies?.[0]
  const loading = Boolean(currentJob)
  const progress = jobProgress?.jobId === currentJob?.job_id ? jobProgress : null
  const progressStep = progress?.step
  const jobStatus = progress?.status || currentJob?.status || 'queued'
  const canCancelJob = ['queued', 'running', 'cancelling'].includes(jobStatus)
  const jobMessage = progress?.message || '서버에서 현재 진행 단계를 확인하고 있습니다.'
  const planningBrief = displayReport ? displayReport.planning_brief : currentJob ? currentJob.planning_brief : readPlanningDraft(region.code)

  const needsPreparation = Boolean(displayReport && !displayReport.__preparedForPreview && (!displayReport.reference_estimate?.items ||
    !displayReport.target_proposal_basis?.capacity_plan?.version))

  useEffect(() => {
    if (!displayReport || needsPreparation) return
    const key = `${region.code}:${displayReport.__savedEntryId || displayReport.generated_at || displayReport.title || 'report'}`
    if (baselineKey.current === key) return
    baselineKey.current = key
    baselineReport.current = cloneReport(displayReport)
    editHistory.current = []
    setHistoryDepth(0)
    setIsModified(false)
  }, [displayReport, needsPreparation, region.code])


  // 브라우저 캐시가 비어도 MySQL 게시판의 해당 지역 최신 생성본을 다시 불러옵니다.
  useEffect(() => {
    if (currentJob || storedReport) return undefined
    let active = true
    getStoredStrategyReports()
      .then((items) => items.find((item) => item.regionCode === region.code))
      .then((entry) => entry ? getStoredStrategyReport(entry.entryId).then((stored) => ({ entry, stored })) : null)
      .then((result) => {
        if (!active || !result) return
        const hydrated = { ...result.stored, __savedEntryId: result.entry.entryId }
        try { setReport(saveReport(region.code, hydrated)) }
        catch { setReport(hydrated) }
      })
      .catch(() => { /* 저장본이 없거나 DB가 잠시 지연되면 새 기획안 안내를 그대로 표시합니다. */ })
    return () => { active = false }
  }, [currentJob, region.code, storedReport])
  useEffect(() => {
    if (!needsPreparation) return undefined
    let active = true
    fetch('/ai/v1/strategy-idea-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(displayReport) })
      .then((response) => { if (!response.ok) throw new Error('목표·견적 미리보기를 불러오지 못했습니다.'); return response.json() })
      .then((prepared) => { if (active) setReport({ ...displayReport, ...prepared, __preparedForPreview: true }) })
      .catch((error) => { if (active) setError(error.message) })
    return () => { active = false }
  }, [displayReport, needsPreparation])

  // 백그라운드 Agent 작업은 페이지를 떠나도 계속되고, 이 화면은 3초마다 완료 여부만 확인합니다.
  useEffect(() => {
    if (!currentJob?.job_id) return undefined
    let isActive = true
    let polling = false
    const poll = async () => {
      if (polling || !isActive) return
      polling = true
      try {
        const job = await getAiStrategyReportJob(region.code, currentJob.job_id)
        if (!isActive) return
        setJobProgress({ jobId: currentJob.job_id, status: job.status, step: job.progress_step, message: job.message || '' })
        if (job.status === 'completed' && job.report) {
          const completed = { ...job.report, __savedEntryId: job.job_id }
          try {
            setReport(saveReport(region.code, completed))
          } catch {
            // 브라우저 저장공간이 부족해도 서버가 만든 본문은 현재 화면에서 확인할 수 있다.
            setReport(completed)
            setError('기획안은 생성됐지만 브라우저 임시 보관 공간이 부족합니다. 문서를 다운로드하고 게시판 저장 여부를 확인해 주세요.')
          } finally {
            if (job.persistence_status === 'failed' || job.message?.includes('MySQL 저장에 실패')) {
              pendingSave.current = { report: completed, regionCode: region.code }
              setSaveStatus({ state: 'failed', message: '기획안은 생성됐지만 게시판 저장에 실패했습니다. 다시 저장을 눌러 주세요.' })
            }
            clearStrategyJobLink()
            clearActiveStrategyJob(region.code)
            setActiveJob(null)
          }
        } else if (job.status === 'completed') {
          clearStrategyJobLink()
          clearActiveStrategyJob(region.code)
          setActiveJob(null)
          setError('완료된 기획안 본문을 불러오지 못했습니다. 같은 조건으로 다시 생성해 주세요.')
        } else if (job.status === 'failed') {
          clearStrategyJobLink()
          clearActiveStrategyJob(region.code)
          setActiveJob(null)
          setError(job.error || job.message || 'AI 전략기획서를 생성하지 못했습니다.')
        } else if (job.status === 'cancelled') {
          clearStrategyJobLink()
          clearActiveStrategyJob(region.code)
          setActiveJob(null)
          setCancellingJob(false)
          setError('기획서 생성을 취소했습니다. Planning 화면에서 입력 조건을 수정한 뒤 다시 생성할 수 있습니다.')
        }
      } catch (requestError) {
        if (!isActive) return
        if (requestError?.status === 404) {
          clearStrategyJobLink()
          clearActiveStrategyJob(region.code)
          setActiveJob(null)
          setError('이전 생성 작업을 서버에서 찾지 못했습니다. 입력 조건은 유지되므로 다시 생성해 주세요.')
        } else {
          setJobProgress({ jobId: currentJob.job_id, step: null, message: '진행 상태 연결이 지연되고 있습니다. 잠시 후 서버 상태를 다시 확인합니다.' })
        }
      } finally { polling = false }
    }
    const resume = () => { if (document.visibilityState === 'visible') poll() }
    poll()
    const timer = window.setInterval(poll, 3000)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    return () => {
      isActive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('focus', resume)
    }
  }, [currentJob?.job_id, region.code])

  const cancelGeneration = async () => {
    if (!currentJob?.job_id || cancellingJob || !canCancelJob) return
    if (!window.confirm('기획서 생성을 취소하시겠습니까?\n이미 사용된 AI 토큰은 되돌릴 수 없습니다.')) return
    setCancellingJob(true)
    setError('')
    try {
      const job = await cancelAiStrategyReportJob(region.code, currentJob.job_id)
      setJobProgress({ jobId: currentJob.job_id, status: job.status, step: job.progress_step, message: job.message || '' })
      if (job.status === 'cancelled') {
        clearStrategyJobLink()
        clearActiveStrategyJob(region.code)
        setActiveJob(null)
        setCancellingJob(false)
        setError('기획서 생성을 취소했습니다. Planning 화면에서 입력 조건을 수정한 뒤 다시 생성할 수 있습니다.')
      }
    } catch (requestError) {
      setCancellingJob(false)
      setError(requestError.message || '취소 요청에 실패했습니다. 다시 시도해주세요.')
    }
  }

  // 실패한 저장은 화면에 남기고 재시도할 수 있습니다. 새 편집은 순서대로 저장합니다.
  const persistEdit = (stored, regionCode) => {
    const revision = ++saveRevision.current
    pendingSave.current = { report: stored, regionCode }
    setSaveStatus({ state: 'saving' })
    queueReportSave(stored.__savedEntryId, regionCode, stored)
      .then(() => {
        if (revision !== saveRevision.current) return
        pendingSave.current = null; setSaveStatus({ state: 'saved' })
      })
      .catch((requestError) => {
        if (revision === saveRevision.current) setSaveStatus({ state: 'failed', message: requestError.message })
      })
  }
  useEffect(() => {
    if (!['saving', 'failed'].includes(saveStatus.state)) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveStatus.state])

  const applyPatch = (patch) => {
    if (!displayReport?.strategies?.[0]) return
    editHistory.current = [...editHistory.current.slice(-19), cloneReport(displayReport)]
    setHistoryDepth(editHistory.current.length)
    const next = applyReportPatch(displayReport, patch)
    let stored = { ...next, __savedEntryId: next.__savedEntryId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}` }
    try { stored = saveReport(region.code, stored) }
    catch { setError('수정 내용은 화면에 반영됐지만 브라우저 임시 보관 공간이 부족합니다.') }
    setReport(stored)
    setIsModified(true)
    persistEdit(stored, region.code)
  }

  const restoreReport = (next, modified) => {
    if (!next) return
    let stored = { ...cloneReport(next), __savedEntryId: displayReport?.__savedEntryId || next.__savedEntryId }
    try { stored = saveReport(region.code, stored) }
    catch { setError('복원 내용은 화면에 반영됐지만 브라우저 임시 보관 공간이 부족합니다.') }
    setReport(stored)
    setIsModified(modified)
    persistEdit(stored, region.code)
  }

  const undoEdit = () => {
    const previous = editHistory.current.pop()
    if (!previous) return
    setHistoryDepth(editHistory.current.length)
    restoreReport(previous, reportFingerprint(previous) !== reportFingerprint(baselineReport.current))
  }

  const resetEdits = () => {
    if (!baselineReport.current || !displayReport || !isModified) return
    editHistory.current = [...editHistory.current.slice(-19), cloneReport(displayReport)]
    setHistoryDepth(editHistory.current.length)
    restoreReport(baselineReport.current, false)
  }

  const downloadPlan = async (format) => {
    if (!displayReport) return
    setDownloadingFormat(format); setError('')
    try {
      const blob = format === 'docx' ? await downloadAiStrategyProposal(region.code, displayReport) : await downloadAiStrategyPresentation(region.code, displayReport)
      downloadBlob(blob, `${region.name.replaceAll(' ', '-')}-관광-전략기획안.${format}`)
    } catch (requestError) { setError(requestError.message) } finally { setDownloadingFormat('') }
  }

  return <WorkspaceShell>
    <main className="tourism-work-page strategy-page">
      <header className="work-page-header strategy-page-header"><div><h1>{region.name}</h1></div></header>
      <WorkspaceConversationProvider key={`${region.code}-${displayReport?.__savedEntryId || 'draft'}`}><div className="strategy-workspace">
        <section className="strategy-canvas">
          {error && <p className="work-error">{error}</p>}
          {saveStatus.state !== 'idle' && <p className={saveStatus.state === 'failed' ? 'work-error' : 'strategy-save-status'} role="status">{saveStatus.state === 'saving' && <LoaderCircle size={15} />}{saveStatus.state === 'saving' ? '기획서 수정 내용을 반영하고 자동 저장 중입니다…' : saveStatus.state === 'saved' ? '게시판에 자동 저장했습니다.' : `자동 저장 실패: ${saveStatus.message}`}{saveStatus.state === 'failed' && <button type="button" onClick={() => { const pending = pendingSave.current; if (pending) persistEdit(pending.report, pending.regionCode) }}>다시 저장</button>}</p>}
          {displayReport?.generation_mode === 'offline_sample' && <p className="work-error">오프라인 테스트 결과입니다. 입력 여건에 맞춘 AI 조사·기획은 실행되지 않았습니다.</p>}
          {!displayReport && !loading && <section className="strategy-start"><span><Sparkles size={21} /></span><h3>지역에 필요한 사업을 AI가 제안합니다.</h3><p>예산·일정·실행 여건을 확인한 뒤, 지역 데이터와 공식 사례를 조사해 기획안을 만듭니다. 모르는 조건은 미정으로 시작할 수 있습니다.</p></section>}
          {loading && <section className="strategy-start strategy-start--loading"><span className="strategy-job-loader" aria-hidden="true"><i /><i /><LoaderCircle size={22} /></span><h3>기획서 초안을 생성 중입니다</h3><StrategyJobWaitingNotice key={currentJob.job_id} jobId={currentJob.job_id} startedAt={currentJob.started_at || (persistedJob?.job_id === currentJob.job_id ? persistedJob.started_at : undefined)} /><p role="status" aria-live="polite">{jobMessage}</p><div className="strategy-job-flow" aria-label="기획서 생성 진행 단계">{['데이터 분석', '공식사례 확인', '기획안 생성', '품질검토'].map((label, index) => <div className="strategy-job-stage" key={label}><span className={Number.isInteger(progressStep) && index < progressStep ? 'is-complete' : index === progressStep ? 'is-current' : ''} aria-current={index === progressStep ? 'step' : undefined}>{Number.isInteger(progressStep) && index < progressStep && <CheckCircle2 size={12} aria-hidden="true" />}{label}<b className="strategy-job-sr">{Number.isInteger(progressStep) && index < progressStep ? ' 완료' : index === progressStep ? ' 진행 중' : ' 대기'}</b></span>{index < 3 && <i className={Number.isInteger(progressStep) && index < progressStep ? 'is-complete' : ''} aria-hidden="true" />}</div>)}</div>{canCancelJob && <button type="button" className="strategy-job-cancel" onClick={cancelGeneration} disabled={cancellingJob || jobStatus === 'cancelling'} aria-busy={cancellingJob}>{cancellingJob || jobStatus === 'cancelling' ? '취소 중...' : '기획서 생성 취소'}</button>}<small>다른 탭이나 페이지로 이동해도 생성은 계속됩니다. 돌아오면 진행 상태를 다시 확인합니다.</small></section>}
          {displayReport && strategy && <StrategyPresentationPreview region={region} report={displayReport} planningBrief={planningBrief} onApplyPatch={applyPatch} onDownload={downloadPlan} downloadingFormat={downloadingFormat} onReset={resetEdits} onUndo={undoEdit} canReset={isModified} canUndo={historyDepth > 0} editing={saveStatus.state === 'saving'} />}
        </section>
        <WorkspaceAssistantPanel key={`${region.code}-${displayReport?.__savedEntryId || 'draft'}`} planningBrief={planningBrief} region={region} report={displayReport} onApplyPatch={applyPatch} applying={saveStatus.state === 'saving'} />
      </div></WorkspaceConversationProvider>
    </main>
  </WorkspaceShell>
}
