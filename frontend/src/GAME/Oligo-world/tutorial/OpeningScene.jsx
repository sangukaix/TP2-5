import { useEffect, useRef, useState } from 'react'
import oligo from '../images/올리고1.png'
import toki from '../images/토키1.png'
import hochi from '../images/호치1.png'
import miho from '../images/미호1.png'
import './OpeningScene.css'

const cast = {
  oligo: { name: '올리고', image: oligo },
  toki: { name: '토키', image: toki },
  hochi: { name: '호치', image: hochi },
  miho: { name: '미호', image: miho },
}

const dialogue = [
  '안녕하세요, 올리고 월드에 오신 걸 환영합니다!',
  '게임에 앞서 튜토리얼을 진행하겠습니다.',
  '흠... 우선, 여러분과 함께 모험을 떠날 저 친구를 좀 깨워야겠네요...ㅎ.. 잠시만요~',
  '흠.... 아...아무튼 잘 자긴 했어....',
  '지금부터 튜토리얼을 시작합니다!',
  '화면에 표시된 방향대로 방향키를 이용해 캐릭터를 움직여보세요!',
]

const beats = {
  welcome:    { line: 0, next: 'intro' },
  intro:      { line: 1, next: 'wakeIntro' },
  wakeIntro:  { line: 2, next: 'aura' },
  aura:       { line: 2, next: 'strike', duration: 720 },
  strike:     { line: 3, next: 'reply', duration: 480 },
  reply:      { line: 3, next: 'start' },
  start:      { line: 4, next: 'directions' },
  directions: { line: 5 },
}

function advance(current) {
  const beat = beats[current]
  return beat.duration || !beat.next ? current : beat.next
}

export default function OpeningScene({ characterId, background }) {
  const [phase, setPhase] = useState('welcome')
  const scene = useRef(null)
  const beat = beats[phase]
  const player = cast[characterId]
  const speaker = beat.line === 3 ? player : cast.oligo
  const asleep = beat.line < 3

  useEffect(() => {
    scene.current.focus({ preventScroll: true })
    function onKeyDown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return
      if (!scene.current.contains(event.target) && event.target !== document.body) return
      if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        return
      }
      if (event.code !== 'Space' && event.key !== ' ') return
      event.preventDefault()
      if (!event.repeat) setPhase(advance)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!beat.duration) return undefined
    const timer = window.setTimeout(() => setPhase(beat.next), beat.duration)
    return () => window.clearTimeout(timer)
  }, [beat])

  return <section className="oligo-opening" ref={scene} tabIndex={-1} aria-label="튜토리얼 첫 장면">
    <div className="oligo-opening-stage">
      <div className="oligo-opening-room" style={{ backgroundImage: `url("${background}")` }}>
        <div className={'oligo-opening-guide' + (phase === 'aura' ? ' is-charging' : '')}>
          <img src={oligo} alt="안내 캐릭터 올리고" />
          {phase === 'aura' && <span className="oligo-opening-aura" aria-hidden="true" />}
        </div>
        <div className={'oligo-opening-player ' + (asleep ? 'is-asleep' : 'is-awake')}>
          <img src={player.image} alt={asleep ? `침대에 누워 자는 ${player.name}` : `침대 옆에 선 ${player.name}`} />
          {asleep && <span className="oligo-opening-zzz" aria-hidden="true">Zzz</span>}
        </div>
        {asleep && <div className="oligo-opening-quilt" aria-hidden="true" />}
        {phase === 'strike' && <span className="oligo-opening-bolt" aria-label="잠든 캐릭터에게 떨어지는 번개" role="img" />}
        {phase === 'directions' && <span className="oligo-opening-arrow" aria-label="오른쪽으로 이동" role="img">➜</span>}
      </div>
    </div>
    <div className="oligo-opening-message">
      <div className="oligo-opening-portrait"><img src={speaker.image} alt={`${speaker.name} 초상화`} /></div>
      <div className="oligo-opening-copy">
        <p aria-live="polite" aria-atomic="true"><strong>{speaker.name}</strong> : {dialogue[beat.line]}</p>
        {phase === 'directions' ? <div className="oligo-opening-keys" aria-label="오른쪽 방향키 안내">
          <kbd>→</kbd> 오른쪽 방향키
        </div> : <button type="button" className="oligo-opening-next" disabled={Boolean(beat.duration)}
          onClick={() => setPhase(advance)}><kbd>스페이스바</kbd> 다음 대사 ▸</button>}
      </div>
    </div>
  </section>
}
