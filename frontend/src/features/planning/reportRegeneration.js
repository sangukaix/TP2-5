export const REPORT_REGENERATION_CONFIRMATION = '기획서를 다시 생성해야하며, 현재 수정하고 있는 기획서는 삭제됩니다. 새로 생성을 하시겠습니까?'

/** 챗봇의 제안을 새 기획안 생성 API가 받는 최소 계약으로 바꿉니다. */
export function buildReportRegenerationPayload(region, proposal, currentPlanningBrief) {
  if (!region?.code || !region?.name) throw new Error('선택 지역을 확인하지 못했습니다.')
  if (!['candidate_change', 'budget_change'].includes(proposal?.reason)) {
    throw new Error('지원하지 않는 기획서 재생성 요청입니다.')
  }
  if (!/^[\w-]{1,64}$/.test(String(proposal.source_report_id || ''))) {
    throw new Error('다시 생성할 원본 기획안을 확인하지 못했습니다.')
  }
  const planningBrief = proposal.planning_brief || currentPlanningBrief
  if (!planningBrief || planningBrief.region_code !== region.code) {
    throw new Error('현재 지역의 기획 조건을 확인하지 못했습니다.')
  }
  return {
    region_name: region.name,
    planning_brief: planningBrief,
    regeneration_request: {
      reason: proposal.reason,
      request_text: String(proposal.request_text || '').slice(0, 1000),
      source_report_id: proposal.source_report_id,
      requested_candidate_id: String(proposal.requested_candidate_id || ''),
      requested_candidate_title: String(proposal.requested_candidate_title || ''),
      requested_candidate_index: proposal.requested_candidate_index || null,
      requested_budget_krw: proposal.requested_budget_krw || null,
    },
  }
}
