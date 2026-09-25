import { useEffect, useState } from 'react'
import { navigateGame } from '../gameNavigation'
import LadderIcon from './LadderIcon'
import { generateLadder, traceLadder, validateLadderEntries, MIN_PLAYERS, MAX_PLAYERS } from './ladderEngine'
import './LadderGame.css'

const DEFAULT_PARTICIPANTS = ['사람1', '사람2', '사람3', '사람4']
const DEFAULT_RESULTS = ['한식', '중식', '일식', '자유선택']
const COLUMN_WIDTH = 108
const TOP_Y = 18
const ROW_HEIGHT = 27

function getBottomY(ladder) {
  return TOP_Y + (ladder.rows.length + 1) * ROW_HEIGHT
}

function getPath(ladder, startIndex, crossings) {
  const x = (index) => (index + 0.5) * COLUMN_WIDTH
  const byRow = new Map(crossings.map((crossing) => [crossing.row, crossing]))
  const points = [`M ${x(startIndex)} ${TOP_Y}`]
  let position = startIndex

  ladder.rows.forEach((_, row) => {
    const y = TOP_Y + (row + 1) * ROW_HEIGHT
    points.push(`L ${x(position)} ${y}`)
    const crossing = byRow.get(row)
    if (crossing) {
      position = crossing.to
      points.push(`L ${x(position)} ${y}`)
    }
  })
  points.push(`L ${x(position)} ${getBottomY(ladder)}`)
  return points.join(' ')
}

export default function LadderGame() {
  const [participants, setParticipants] = useState(DEFAULT_PARTICIPANTS)
  const [results, setResults] = useState(DEFAULT_RESULTS)
  const [ladder, setLadder] = useState(null)
  const [selection, setSelection] = useState(null)
  const [revealed, setRevealed] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ladder || !selection) return undefined
    const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 2300
    const timer = window.setTimeout(() => {
      setRevealed({ index: selection.index,
        endIndex: traceLadder(ladder, selection.index).endIndex })
    }, delay)
    return () => window.clearTimeout(timer)
  }, [ladder, selection])

  const updateEntry = (setter, index, value) => {
    setter((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))
    setError('')
  }

  const addParticipant = () => {
    if (participants.length >= MAX_PLAYERS) return
    setParticipants((current) => [...current, ''])
    setResults((current) => [...current, ''])
    setError('')
  }

  const removeParticipant = (index) => {
    if (participants.length <= MIN_PLAYERS) return
    setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setResults((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setError('')
  }

  const startGame = () => {
    const validationError = validateLadderEntries(participants, results)
    if (validationError) {
      setError(validationError)
      return
    }
    setParticipants(participants.map((name) => name.trim()))
    setResults(results.map((result) => result.trim()))
    setLadder(generateLadder(participants.length))
    setSelection(null)
    setRevealed(null)
    setShowAll(false)
    setError('')
  }

  const replay = () => {
    setLadder(generateLadder(participants.length))
    setSelection(null)
    setRevealed(null)
    setShowAll(false)
  }

  const boardWidth = ladder ? ladder.count * COLUMN_WIDTH : 0
  const bottomY = ladder ? getBottomY(ladder) : 0
  const selectedTrace = ladder && selection ? traceLadder(ladder, selection.index) : null

  return (
    <main className="ladder-game-page">
      <div className="ladder-game-shell">
        <nav className="ladder-game-nav" aria-label="게임 이동">
          <a href="/game" onClick={navigateGame}>← GAME HUB</a>
          <a href="/game/oligo-world" onClick={navigateGame}>Oligo World</a>
        </nav>
        <header className="ladder-game-header">
          <span>QUICK GAME · OLIGO-K</span>
          <h1><LadderIcon className="ladder-game-title-icon" />오늘 뭐 먹지?</h1>
          <p>점심 메뉴, 커피 당번, 발표 순서까지 사다리로 가볍게 정해보세요.</p>
        </header>

        {!ladder ? (
          <section className="ladder-game-setup" aria-labelledby="ladder-game-setup-title">
            <div className="ladder-game-section-heading">
              <h2 id="ladder-game-setup-title">참가자와 결과</h2>
              <span>{participants.length}명 · 최대 {MAX_PLAYERS}명</span>
            </div>
            <p className="ladder-game-help">참가자와 결과를 한 줄씩 입력하세요. 시작하면 실제 사다리 선이 결과를 결정합니다.</p>
            <div className="ladder-game-entries">
              {participants.map((name, index) => (
                <div className="ladder-game-entry" key={index}>
                  <div className="ladder-game-field">
                    <label htmlFor={`ladder-participant-${index}`}>참가자 {index + 1}</label>
                    <input id={`ladder-participant-${index}`} value={name} maxLength={20}
                      onChange={(event) => updateEntry(setParticipants, index, event.target.value)}
                      placeholder="이름 입력" />
                  </div>
                  <div className="ladder-game-field">
                    <label htmlFor={`ladder-result-${index}`}>결과 {index + 1}</label>
                    <input id={`ladder-result-${index}`} value={results[index]} maxLength={24}
                      onChange={(event) => updateEntry(setResults, index, event.target.value)}
                      placeholder="메뉴 또는 결과 입력" />
                  </div>
                  <button type="button" className="ladder-game-remove" onClick={() => removeParticipant(index)}
                    disabled={participants.length <= MIN_PLAYERS} aria-label={`${index + 1}번째 참가자와 결과 삭제`}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
            {error && <p className="ladder-game-error" role="alert">{error}</p>}
            <div className="ladder-game-setup-actions">
              <button type="button" className="ladder-game-add" onClick={addParticipant}
                disabled={participants.length >= MAX_PLAYERS}>+ 참가자 추가</button>
              <button type="button" className="ladder-game-primary" onClick={startGame}>사다리 만들기</button>
            </div>
          </section>
        ) : (
          <section className="ladder-game-play" aria-labelledby="ladder-game-play-title">
            <div className="ladder-game-section-heading">
              <h2 id="ladder-game-play-title">한 명씩 출발해 보세요</h2>
              <span>이름을 누르면 경로가 나타납니다</span>
            </div>
            <div className="ladder-game-board-scroll">
              <div className="ladder-game-board" style={{ width: boardWidth,
                '--ladder-columns': ladder.count }}>
                <div className="ladder-game-participants">
                  {participants.map((name, index) => (
                    <button type="button" key={index} onClick={() => {
                      setSelection((current) => ({ index, runId: (current?.runId || 0) + 1 }))
                      setRevealed(null)
                      setShowAll(false)
                    }} aria-pressed={selection?.index === index}>
                      {name} 출발
                    </button>
                  ))}
                </div>
                <svg className="ladder-game-svg" width={boardWidth} height={bottomY + 16}
                  viewBox={`0 0 ${boardWidth} ${bottomY + 16}`} role="img"
                  aria-label="참가자 이름에서 아래 결과까지 이어지는 사다리">
                  {participants.map((_, index) => (
                    <line className="ladder-game-vertical" key={`vertical-${index}`}
                      x1={(index + 0.5) * COLUMN_WIDTH} x2={(index + 0.5) * COLUMN_WIDTH}
                      y1={TOP_Y} y2={bottomY} />
                  ))}
                  {ladder.rows.flatMap((row, rowIndex) => row.map((left) => (
                    <line className="ladder-game-rung" key={`${rowIndex}-${left}`}
                      x1={(left + 0.5) * COLUMN_WIDTH} x2={(left + 1.5) * COLUMN_WIDTH}
                      y1={TOP_Y + (rowIndex + 1) * ROW_HEIGHT}
                      y2={TOP_Y + (rowIndex + 1) * ROW_HEIGHT} />
                  )))}
                  {selectedTrace && <path className="ladder-game-trace"
                    key={`${selection.index}-${selection.runId}`}
                    d={getPath(ladder, selection.index, selectedTrace.crossings)} pathLength="100" />}
                </svg>
                <div className="ladder-game-results">
                  {results.map((result, index) => <span key={index}>{result}</span>)}
                </div>
              </div>
            </div>

            {revealed && <div className="ladder-game-reveal" role="status" aria-live="polite">
              <span>🎉 {participants[revealed.index]}님의 결과</span>
              <strong>{results[revealed.endIndex]}</strong>
              <button type="button" onClick={() => {
                setRevealed(null)
                setSelection(null)
              }}>결과 닫기</button>
            </div>}

            {showAll && <div className="ladder-game-all-results">
              <h3>전체 결과</h3>
              <ul>{participants.map((name, index) => (
                <li key={index}><span>{name}</span><strong>{results[traceLadder(ladder, index).endIndex]}</strong></li>
              ))}</ul>
            </div>}

            <div className="ladder-game-play-actions">
              <button type="button" onClick={() => {
                setSelection(null)
                setRevealed(null)
                setShowAll(true)
              }}>전체 결과 보기</button>
              <button type="button" onClick={replay}>같은 멤버로 다시 하기</button>
              <button type="button" onClick={() => {
                setLadder(null)
                setSelection(null)
                setRevealed(null)
                setShowAll(false)
              }}>처음부터</button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
