import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReportRegenerationPayload, REPORT_REGENERATION_CONFIRMATION } from './reportRegeneration.js'

test('후보 변경 요청은 원본 ID와 현재 기획 조건을 생성 API 계약으로 보낸다', () => {
  const payload = buildReportRegenerationPayload(
    { code: '42150', name: '강원특별자치도 강릉시' },
    { reason: 'candidate_change', request_text: '2번째 후보로 만들어줘', source_report_id: 'old-job', requested_candidate_id: 'candidate-2', requested_candidate_title: '후보 2', requested_candidate_index: 2 },
    { region_code: '42150', input_profile: 'guided_v2' },
  )
  assert.equal(payload.region_name, '강원특별자치도 강릉시')
  assert.equal(payload.regeneration_request.source_report_id, 'old-job')
  assert.equal(payload.regeneration_request.requested_candidate_index, 2)
})

test('예산 변경 제안이 가진 새 planning brief를 우선한다', () => {
  const payload = buildReportRegenerationPayload(
    { code: '42150', name: '강릉시' },
    { reason: 'budget_change', request_text: '예산을 5천만원으로 변경', source_report_id: 'old-job', requested_budget_krw: 50_000_000, planning_brief: { region_code: '42150', budget_max_krw: 50_000_000 } },
    { region_code: '42150', budget_max_krw: null },
  )
  assert.equal(payload.planning_brief.budget_max_krw, 50_000_000)
  assert.equal(payload.regeneration_request.requested_budget_krw, 50_000_000)
  assert.match(REPORT_REGENERATION_CONFIRMATION, /현재 수정하고 있는 기획서는 삭제됩니다/)
})
