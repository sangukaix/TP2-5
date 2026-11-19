import { useCallback, useEffect, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { characters } from '../characters'
import { openingRoomFor } from './openingRoomArt'
import mihoDown from '../images/motions/미호_걷기_Down.png'
import mihoLeft from '../images/motions/미호_걷기_Left.png'
import mihoRight from '../images/motions/미호_걷기_Right.png'
import mihoUp from '../images/motions/미호_걷기_Up.png'
import oligoPortrait from '../images/올리고2.png'
import tokiPortrait from '../images/토키3.png'
import hochiPortrait from '../images/호치3.png'
import mihoPortrait from '../images/미호3.png'
import tokiSprite from '../images/토키1.png'
import hochiSprite from '../images/호치1.png'
import mihoSprite from '../images/미호1.png'
import { directionKeys, practiceOrder } from './openingRoom'
import { useRoomWalk } from './useRoomWalk'
import './OpeningScene.css'

const cast = {
  oligo: { name: '올리고', portrait: oligoPortrait },
  toki: { portrait: tokiPortrait, sprite: tokiSprite, walkSheets: null },
  hochi: { portrait: hochiPortrait, sprite: hochiSprite, walkSheets: null },
  miho: {
    portrait: mihoPortrait, sprite: mihoSprite,
    walkSheets: { ArrowDown: mihoDown, ArrowLeft: mihoLeft, ArrowRight: mihoRight, ArrowUp: mihoUp },
  },
}
const strikeFrameMs = 200
const strikeFrameCount = 10
// The painted sleeper spans roughly 18% of the room width from pillow to feet.
// The standing figure covers about 402 of the 512 rows in each frame.
const roomFrameWidthAtMihoHeight = 23
const practiceKeys = ['Q', 'W', 'E', 'R', 'Space', '↑', '←', '↓', '→']

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
  aura:       { line: 2, next: 'strike', duration: 3300 },
  strike:     { line: 2, next: 'reply', duration: 480 },
  reply:      { line: 3, next: 'start' },
  start:      { line: 4, next: 'guidance' },
  guidance:   { line: 5, next: 'directions' },
  directions: { line: 5 },
}

export default function OpeningScene({ characterId }) {
  const [phase, setPhase] = useState('welcome')
  const [strikeSlot, setStrikeSlot] = useState(0)
  const [strikeReady, setStrikeReady] = useState(false)
  const scene = useRef(null)
  const strikeImages = useRef(null)
  const strikeDecoded = useRef(null)
  const beat = beats[phase]
  const character = characters[characterId]
  const player = { ...cast[characterId], name: character.displayName }
  const room = openingRoomFor(characterId)
  const speaker = beat.line === 3 ? player : cast.oligo
  const asleep = beat.line < 3
  const hasWalkSheets = Boolean(player.walkSheets)
  const practicing = hasWalkSheets && phase === 'directions'
  const walk = useRoomWalk(practicing, scene, room.layout)
  const requested = directionKeys[practiceOrder[walk.lesson]]
  const fullStrike = phase === 'strike' && strikeReady
  const paintedSleep = asleep && room.sleep && !fullStrike
  const facingSheet = player.walkSheets?.[walk.facing]
  const directionSuffix = requested?.name.endsWith('쪽') ? '을' : '를'
  const movementSuffix = directionSuffix === '을' ? '으로' : '로'
  const line = practicing
    ? requested
      ? `방향키 ${requested.name}${directionSuffix} 눌러 ${player.name}를 ${requested.name}${movementSuffix} 이동시켜보세요!`
      : '방향키 연습을 마쳤습니다.'
    : dialogue[beat.line]

  const advance = useCallback(current => {
    // The other characters still stop at the original direction instruction.
    if (current === 'start' && !hasWalkSheets) return 'directions'
    const step = beats[current]
    return step.duration || !step.next ? current : step.next
  }, [hasWalkSheets])

  useEffect(() => {
    if (!room.strike.length) return
    strikeDecoded.current = Promise.all(Array.from(strikeImages.current.children, image => image.decode()))
      .then(() => true, () => false)
    preload(room.empty, { as: 'image' })
    preload(room.sleep, { as: 'image' })
    for (const sheet of Object.values(player.walkSheets ?? {})) preload(sheet, { as: 'image' })
  }, [room, player.walkSheets])

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
  }, [advance])

  useEffect(() => {
    if (!beat.duration) return undefined
    let active = true
    let interval
    const fullStrikeDuration = fullStrike ? strikeFrameMs * strikeFrameCount : beat.duration
    const timer = window.setTimeout(async () => {
      if (phase === 'aura' && strikeDecoded.current) {
        const ready = await strikeDecoded.current
        if (!active) return
        setStrikeReady(ready)
      }
      setPhase(beat.next)
    }, fullStrikeDuration)
    if (fullStrike) {
      interval = window.setInterval(() => {
        setStrikeSlot(slot => Math.min(slot + 1, strikeFrameCount - 1))
      }, strikeFrameMs)
    }
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [beat, fullStrike, phase])

  return <section className="oligo-opening" ref={scene} tabIndex={-1} aria-label="튜토리얼 첫 장면">
    <div className="oligo-opening-room" style={{ backgroundImage: `url("${paintedSleep ? room.sleep : room.empty}")`,
      aspectRatio: room.layout.aspect }}
      data-character={characterId}>
      {room.strike.length > 0 && <div className="oligo-opening-strike-frames" ref={strikeImages}
        role={fullStrike ? 'img' : undefined} aria-label={fullStrike ? `${player.name}에게 떨어지는 번개` : undefined}
        aria-hidden={!fullStrike}>
        {room.strike.map((src, index) => <img key={src} src={src} alt=""
          style={{ visibility: fullStrike && index === strikeSlot % 2 ? 'visible' : 'hidden' }} />)}
      </div>}
      {paintedSleep && <span className="oligo-opening-sr-only">침대에 누워 자는 {player.name}</span>}
      {!fullStrike && !paintedSleep && (asleep || !facingSheet) &&
      <div className={'oligo-opening-player ' + (asleep ? 'is-asleep' : 'is-awake')}>
        <img src={player.sprite} alt={asleep ? `침대에 누워 자는 ${player.name}` : `침대 옆에 선 ${player.name}`} />
      </div>}
      {!asleep && facingSheet && <div className="oligo-opening-walker" role="img"
        aria-label={walk.walking ? `걷는 ${player.name}` : `서 있는 ${player.name}`}
        data-facing={walk.facing} style={{ left: `${walk.position.x}%`, top: `${walk.position.y}%`,
          width: `${roomFrameWidthAtMihoHeight * character.heightCm / characters.miho.heightCm}%` }}>
        <div key={walk.facing} className={walk.walking ? 'is-walking' : ''}
          style={{ backgroundImage: `url("${facingSheet}")` }} />
      </div>}
      {asleep && !fullStrike && <span className="oligo-opening-zzz" aria-hidden="true">Zzz</span>}
      {phase === 'strike' && !fullStrike && <span className="oligo-opening-bolt" aria-label="잠든 캐릭터에게 떨어지는 번개" role="img" />}
      {phase === 'directions' && !practicing && <span className="oligo-opening-arrow" aria-label="오른쪽으로 이동" role="img">➜</span>}
      {practicing && <div className="oligo-opening-keyboard" aria-label="조작 키">
        {practiceKeys.map(key => <kbd key={key} className={key === requested?.glyph ? 'is-requested' : undefined}>{key}</kbd>)}
      </div>}
    </div>
    <div className="oligo-opening-message">
      <div className="oligo-opening-portrait">
        <div className="oligo-opening-portrait-art">
          <img src={speaker.portrait} alt={`${speaker.name} 초상화`} />
          {phase === 'aura' && <span className="oligo-opening-aura" aria-hidden="true">
            <i /><i /><i /><i />
          </span>}
        </div>
      </div>
      <div className="oligo-opening-copy">
        <p aria-live="polite" aria-atomic="true"><strong>{speaker.name}</strong> : {line}</p>
        {phase === 'directions' && !practicing && <div className="oligo-opening-keys" aria-label="오른쪽 방향키 안내">
          <kbd>→</kbd> 오른쪽 방향키
        </div>}
        {phase !== 'directions' && <button type="button" className="oligo-opening-next" disabled={Boolean(beat.duration)}
          onClick={() => setPhase(advance)}><kbd>스페이스바</kbd> 다음 대사 ▸</button>}
      </div>
    </div>
  </section>
}
