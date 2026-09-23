import { Bot, Globe2, LoaderCircle, Send } from 'lucide-react'
import { useState } from 'react'
import { useWorkspaceConversation } from './workspaceConversationContext'
import { chatWithTourismAssistant } from '../api/dashboardApi'
import { chatHistory } from '../features/planning/chatHistory'
import ByokConnectionPanel from './ByokConnectionPanel'

// 처음 보는 사용자가 질문 범위를 이해할 수 있도록 보여 주는 안내 예시입니다.
// 클릭 시 바로 질문을 보내지 않으며, 사용자가 자신의 문장으로 작성합니다.
const QUICK_QUESTIONS = [
  '이 기획안에서 수정할 수 있는 항목을 알려줘.',
  '방문 목표 4%, 소비 목표 5%로 바꿔줘.',
  '현재 사업의 홍보 문구를 쉽게 바꿔줘.',
]

/** bid3 제안서 화면의 우측 AI 비서 역할을 관광 전략용으로 이식한 패널입니다. */
export default function WorkspaceAssistantPanel({ region, report, onApplyPatch, planningBrief, applying = false }) {
  const { messages, setMessages, question, setQuestion, useWebSearch, setUseWebSearch,
    appliedPatch, setAppliedPatch, loading, setLoading, error, setError, beginRequest, endRequest } = useWorkspaceConversation()
  const [byokSession, setByokSession] = useState(null)

  // 질문을 API에 보내고, 최근 8개 대화만 함께 전달합니다.
  // 기록 길이를 제한하면 토큰 비용과 응답 지연을 일정하게 유지할 수 있습니다.
  const ask = async (preset) => {
    const content = String(preset || question).trim()
    if (!content || !beginRequest()) return
    if (byokSession?.runtime_mode === 'openai_byok' && !byokSession.connected) {
      setError('AI 챗봇을 사용하려면 OpenAI API Key를 다시 연결해주세요.'); endRequest(); return
    }
    const history = [...messages, { role: 'user', content }]
    setMessages(history)
    setQuestion('')
    setError('')
    setLoading(true)
    try {
      const answer = await chatWithTourismAssistant(region.code, {
        region_name: region.name,
        question: content,
        history: chatHistory(history),
        current_report: report,
        planning_brief: planningBrief || null,
        enable_web_search: useWebSearch,
      })
      setMessages((items) => [...items, { role: 'assistant', ...answer }])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      endRequest()
      setLoading(false)
    }
  }

  // AI가 ‘수정안(report_patch)’을 준 가장 최근 답변만 적용 버튼에 연결합니다.
  // 자동 반영하지 않아 사용자가 제안 내용을 확인한 후에만 기획안을 바꿀 수 있습니다.
  const latestPatch = [...messages].reverse().find((item) => item.role === 'assistant' && item.report_patch)?.report_patch

  return <aside className="workspace-chat" aria-label="AI 챗봇">
    <header><span><Bot size={17} /></span><div><b>AI 챗봇</b></div><em>{loading ? '응답 중' : error ? '요청 실패' : '질문 대기'}</em></header>
    <p className="workspace-chat-intro">현재 아이디어의 목표 KPI·예상 견적·문장·실행 단계를 조정하세요. 다른 사업은 근거가 연결된 후보 안에서 비교할 수 있습니다.</p>
    <ByokConnectionPanel compact onChange={setByokSession} />
    <div className="workspace-chat-messages">
      {messages.length === 0 && <div className="workspace-chat-empty">{QUICK_QUESTIONS.map((item) => <p key={item}>{item}</p>)}</div>}
      {messages.map((message, index) => (
        <article className={`workspace-chat-message is-${message.role}`} key={`${message.role}-${index}`}>
          <b>{message.role === 'assistant' ? 'AI' : '나'}</b>
          <div>
            <p>{message.content || message.answer}</p>
            {message.role === 'assistant' && <small className="workspace-chat-execution">{message.generation_mode === 'offline_sample' ? '오프라인 예시 · 모델 응답 아님' : `${message.execution?.model || message.generation_mode || '모델 정보 없음'} · ${message.execution?.web_search_used ? 'OpenAI 웹 검색 사용' : '새 웹 검색 미사용'}`}</small>}
            {message.key_points?.length > 0 && <ul>{message.key_points.map((point) => <li key={point}>{point}</li>)}</ul>}
            {message.sources?.length > 0 && (
              <details>
                <summary>공식 출처 {message.sources.length}건</summary>
                {message.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}</a>)}
              </details>
            )}
          </div>
        </article>
      ))}
      {loading && <p className="workspace-chat-thinking"><LoaderCircle size={15} />근거와 지역 데이터를 확인하고 있습니다…</p>}
      {error && <p className="workspace-chat-error">{error}</p>}
    </div>
    {report && latestPatch && onApplyPatch && <button className="workspace-chat-apply" type="button" disabled={loading || applying || appliedPatch === latestPatch} onClick={() => { onApplyPatch(latestPatch); setAppliedPatch(latestPatch) }}>{applying ? <><LoaderCircle size={14} />기획서 수정 중…</> : appliedPatch === latestPatch ? '반영됨 · 자동 저장 상태 확인' : '이 수정안을 기획안에 반영'}</button>}
    <footer className="workspace-chat-composer"><label title={useWebSearch ? '지역명과 이번 질문만 OpenAI 웹 검색에 사용합니다. 수정 반영은 검색을 끄고 요청하세요.' : '현재 보고서 수정은 관리자 Router에 설정된 로컬 모델을 사용합니다.'}><input type="checkbox" checked={useWebSearch} onChange={(event) => setUseWebSearch(event.target.checked)} /><Globe2 size={13} />웹 검색 {useWebSearch ? 'ON' : 'OFF'}</label><div><textarea rows="2" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask() } }} placeholder={useWebSearch ? '공식 자료를 웹에서 찾아 질문하세요.' : '기획안 수정 내용을 입력하세요.'} /><button type="button" onClick={() => ask()} disabled={!question.trim() || loading || (byokSession?.runtime_mode === 'openai_byok' && !byokSession.connected)} aria-label="질문 전송"><Send size={15} /></button></div></footer>
  </aside>
}
