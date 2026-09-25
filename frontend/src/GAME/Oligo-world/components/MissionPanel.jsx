import { TUTORIAL_MOVE_TARGET } from '../tutorial/tutorial01'

export default function MissionPanel({ tutorial, map }) {
  if (map.id !== 'map001') {
    return <aside className="oligo-world-mission"><span>NEW AREA</span>
      <h2>{map.name}</h2><p>다음 모험은 준비 중입니다.</p></aside>
  }

  const movementDone = tutorial.validMoves >= TUTORIAL_MOVE_TARGET
  const doorActive = tutorial.stage === 'toDoor'
  const doorReached = tutorial.rewardGranted
  return (
    <aside className="oligo-world-mission" aria-label="튜토리얼 임무">
      <span>TUTORIAL 01</span>
      <h2>{movementDone ? '첫 걸음을 내디뎌요' : '몸을 풀어 봐요'}</h2>
      <p className={movementDone ? 'oligo-world-mission-done' : ''}>
        {movementDone ? '✓ 방향키로 움직이기' : '방향키로 움직여보기'}
      </p>
      <strong>{tutorial.validMoves} / {TUTORIAL_MOVE_TARGET}</strong>
      {movementDone && <p className="oligo-world-mission-door">
        {doorReached ? '✓ 현관문 도착' : doorActive ? '현관문까지 이동하세요.' :
          '다음 안내를 확인하세요.'}</p>}
    </aside>
  )
}
