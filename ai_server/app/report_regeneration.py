"""Classify and validate report edits that require the full planning pipeline."""

from __future__ import annotations

from copy import deepcopy
import re
from typing import Any


CONFIRMATION_MESSAGE = (
    '기획서를 다시 생성해야하며, 현재 수정하고 있는 기획서는 삭제됩니다. '
    '새로 생성을 하시겠습니까?'
)

_CHANGE_WORDS = r'바꿔|변경|수정|조정|편성|만들|작성|선택|재생성'
_NUMBER_WORDS = {'첫': 1, '한': 1, '두': 2, '둘': 2, '세': 3, '셋': 3}


def _candidate_number(question: str) -> int | None:
    if not re.search(r'후보(?:군)?|지역\s*사례|적용\s*사례|사업\s*안', question):
        return None
    if not re.search(_CHANGE_WORDS, question):
        return None
    match = re.search(r'([1-9]|첫|한|두|둘|세|셋)\s*(?:번|번째)', question)
    if not match:
        return None
    token = match.group(1)
    return int(token) if token.isdigit() else _NUMBER_WORDS.get(token)


def _budget_amount(question: str) -> int | None:
    if not re.search(r'예산\s*편성|사업비|총\s*예산|예산을|예산\s+', question):
        return None
    if not re.search(_CHANGE_WORDS, question):
        return None
    compound = re.search(r'([0-9][0-9,.]*)\s*억\s*([0-9][0-9,.]*)\s*천만\s*원', question)
    if compound:
        amount = round(
            float(compound.group(1).replace(',', '')) * 100_000_000
            + float(compound.group(2).replace(',', '')) * 10_000_000
        )
        return amount if amount <= 1_000_000_000_000 else None
    match = re.search(r'([0-9][0-9,.]*)\s*(억|천만|백만|만)?\s*원', question)
    if not match:
        return None
    factors = {'억': 100_000_000, '천만': 10_000_000, '백만': 1_000_000, '만': 10_000, None: 1}
    amount = round(float(match.group(1).replace(',', '')) * factors[match.group(2)])
    return amount if 1 <= amount <= 1_000_000_000_000 else None


def detect_report_regeneration(report: dict[str, Any] | None, question: str) -> dict[str, Any] | None:
    """Return a deterministic regeneration proposal for explicit structural edits.

    This runs before an LLM so candidate/budget requests remain understandable while
    the user's local model is offline. It never starts or deletes anything itself.
    """
    if not report:
        return None
    source_report_id = str(report.get('__savedEntryId') or '').strip()
    candidates = [
        row for row in (report.get('planning_decision') or {}).get('design_candidates') or []
        if row.get('candidate_id') and row.get('title') and row.get('case_source_ids')
    ]
    candidate_number = _candidate_number(question)
    if candidate_number is not None:
        if candidate_number < 1 or candidate_number > len(candidates):
            return {
                'answer': f'현재 다시 선택할 수 있는 근거 연결 후보는 {len(candidates)}개입니다. 왼쪽부터 1~{len(candidates)}번 안에서 선택해 주세요.',
                'mode': 'explain', 'key_points': [row['title'] for row in candidates], 'sources': [],
                'report_patch': None, 'regeneration_request': None, 'generation_mode': 'local',
                'execution': {'model': '재생성 조건 판별', 'web_search_used': False},
            }
        candidate = candidates[candidate_number - 1]
        return {
            'answer': f'{candidate_number}번째 후보 「{candidate["title"]}」를 중심으로 전체 기획안을 다시 작성할 수 있습니다.',
            'mode': 'regenerate',
            'key_points': [f'선택 후보: {candidate["title"]}', '지역 원자료·ML 전망은 유지하고 실행안·KPI·예산·문서를 다시 계산합니다.'],
            'sources': [], 'report_patch': None,
            'regeneration_request': {
                'reason': 'candidate_change', 'request_text': question[:1000],
                'source_report_id': source_report_id,
                'requested_candidate_id': str(candidate['candidate_id']),
                'requested_candidate_title': str(candidate['title']),
                'requested_candidate_index': candidate_number,
                'requested_budget_krw': None,
                'planning_brief': deepcopy(report.get('planning_brief') or {}),
                'confirmation_message': CONFIRMATION_MESSAGE,
            },
            'generation_mode': 'local',
            'execution': {'model': '재생성 조건 판별', 'web_search_used': False},
        }

    budget_amount = _budget_amount(question)
    if budget_amount is not None:
        brief = deepcopy(report.get('planning_brief') or {})
        brief.update({
            'budget_status': 'indicative', 'budget_min_krw': None,
            'budget_max_krw': budget_amount, 'budget_hard_limit': False,
        })
        return {
            'answer': f'참고 예산을 {budget_amount:,}원으로 바꾸면 사업 규모·운영 단계·KPI·항목별 예산을 함께 다시 계산해야 합니다.',
            'mode': 'regenerate',
            'key_points': [f'새 참고 예산: {budget_amount:,}원', '기존 지역 데이터와 공식 근거를 사용해 전체 기획안을 다시 생성합니다.'],
            'sources': [], 'report_patch': None,
            'regeneration_request': {
                'reason': 'budget_change', 'request_text': question[:1000],
                'source_report_id': source_report_id,
                'requested_candidate_id': '', 'requested_candidate_title': '',
                'requested_candidate_index': None, 'requested_budget_krw': budget_amount,
                'planning_brief': brief, 'confirmation_message': CONFIRMATION_MESSAGE,
            },
            'generation_mode': 'local',
            'execution': {'model': '재생성 조건 판별', 'web_search_used': False},
        }
    return None


def enforce_requested_candidate(
    decision: dict[str, Any], regeneration_request: dict[str, Any] | None,
) -> dict[str, Any]:
    """Select the user-confirmed candidate without inventing a new candidate."""
    if not regeneration_request or regeneration_request.get('reason') != 'candidate_change':
        return decision
    requested_id = str(regeneration_request.get('requested_candidate_id') or '')
    requested_title = str(regeneration_request.get('requested_candidate_title') or '')
    candidates = list(decision.get('design_candidates') or [])
    selected = next((row for row in candidates if str(row.get('candidate_id') or '') == requested_id), None)
    if selected is None and requested_title:
        normalize = lambda value: re.sub(r'\s+', '', str(value or '')).lower()
        selected = next((row for row in candidates if normalize(row.get('title')) == normalize(requested_title)), None)
    if selected is None:
        source_candidate = regeneration_request.get('source_candidate') or {}
        if (str(source_candidate.get('candidate_id') or '') == requested_id
                and source_candidate.get('title') and source_candidate.get('case_source_ids')):
            selected = deepcopy(source_candidate)
            candidates.append(selected)
    if selected is None:
        raise ValueError('요청한 후보를 새 기획안의 근거 후보에서 확인하지 못했습니다.')
    result = deepcopy(decision)
    result['design_candidates'] = candidates
    result['selected_candidate_id'] = selected['candidate_id']
    result['selection_reason'] = f'사용자가 재생성 전에 「{selected["title"]}」 후보를 명시적으로 선택했습니다.'
    return result
