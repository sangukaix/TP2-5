import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import './OligoWorld.css'
import { navigateGame } from '../gameNavigation'
import LadderIcon from '../Ladder-game/LadderIcon'
import nightWorld from './images/Oligo_bg3.png'
import { useAuth } from '../../features/auth/useAuth'
import { gameProfileApi } from './gameProfileApi'
import { characters } from './characters'
import { getMap } from './maps/mapRegistry'
import { gameReducer, initialGameState, movePlayer } from './gameState'
import { tutorialDialogue } from './tutorial/tutorial01'
import CharacterSelect from './components/CharacterSelect'
import DialogueBox from './components/DialogueBox'
import GameHud from './components/GameHud'
import GameViewport from './components/GameViewport'
import MissionPanel from './components/MissionPanel'

export default function OligoWorld() {
  const { user, loading: authLoading } = useAuth()
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
  const [profile, setProfile] = useState(null)
  const [profileStatus, setProfileStatus] = useState('loading')
  const [loadedMemberId, setLoadedMemberId] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle')
  const [clearSaved, setClearSaved] = useState(false)
  const viewportRef = useRef(null)
  const lastMoveAt = useRef(0)
  const saveTimer = useRef(null)
  const inFlight = useRef(Promise.resolve())
  const completionStarted = useRef(false)
  const player = state.player
  const map = player ? getMap(player.currentMapId) : null
  const character = player ? characters[player.characterId] : null
  const dialogue = map?.id === 'map001' && state.phase === 'playing'
    ? tutorialDialogue(state.tutorial.stage) : null

  useEffect(() => {
    if (authLoading || !user) return undefined
    let active = true
    gameProfileApi.load().then(saved => {
      if (!active) return
      setProfile(saved)
      setLoadedMemberId(user.id)
      if (saved?.profile_status === 'ACTIVE') dispatch({ type: 'HYDRATE_PROFILE', profile: saved })
      setProfileStatus('ready')
    }).catch(error => {
      if (active) {
        setLoadedMemberId(user.id)
        setProfileError(error.message)
        setProfileStatus('error')
      }
    })
    return () => { active = false }
  }, [authLoading, user])

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    if (state.phase !== 'playing' || profile?.profile_status !== 'ACTIVE' ||
        loadedMemberId !== user?.id) return undefined
    saveTimer.current = window.setTimeout(() => {
      const data = { current_map_id: player.currentMapId,
        position_x: player.position.x, position_y: player.position.y,
        tutorial_stage: state.tutorial.stage, tutorial_valid_moves: state.tutorial.validMoves }
      const task = inFlight.current.catch(() => {}).then(() => gameProfileApi.saveProgress(data))
      inFlight.current = task
      task.then(() => setSaveStatus('saved')).catch(() => setSaveStatus('error'))
    }, 700)
    return () => window.clearTimeout(saveTimer.current)
  }, [state.phase, player, state.tutorial, profile?.profile_status, loadedMemberId, user?.id])

  const finishTutorial = useCallback(async () => {
    if (!user || loadedMemberId !== user.id) return
    if (completionStarted.current) return
    completionStarted.current = true
    setSaveStatus('saving')
    try {
      await inFlight.current.catch(() => {})
      await gameProfileApi.saveProgress({ current_map_id: 'map001',
        position_x: state.player.position.x, position_y: state.player.position.y,
        tutorial_stage: 'toDoor', tutorial_valid_moves: state.tutorial.validMoves })
      const saved = await gameProfileApi.completeTutorial()
      setProfile(saved)
      dispatch({ type: 'CONFIRM_TUTORIAL_REWARD', profile: saved })
      setClearSaved(true)
      setSaveStatus('saved')
    } catch (error) {
      setProfileError(error.message)
      setSaveStatus('error')
      completionStarted.current = false
    }
  }, [state.player, state.tutorial, loadedMemberId, user])

  useEffect(() => {
    if (state.phase !== 'clear') return undefined
    const timer = window.setTimeout(finishTutorial, 0)
    return () => window.clearTimeout(timer)
  }, [state.phase, finishTutorial])

  useEffect(() => {
    if (state.phase === 'playing') viewportRef.current?.focus()
  }, [state.phase, player?.currentMapId])

  useEffect(() => {
    if (state.phase !== 'playing' || profileStatus !== 'ready' ||
        loadedMemberId !== user?.id) return undefined
    function onKeyDown(event) {
      const target = event.target
      if (target instanceof HTMLElement &&
          target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return
      if (dialogue && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        dispatch({ type: 'ADVANCE_DIALOGUE' })
        return
      }
      if (!event.key.startsWith('Arrow')) return
      event.preventDefault()
      if (dialogue || Date.now() - lastMoveAt.current < 135) return
      if (!movePlayer(player, map, event.key).moved) return
      lastMoveAt.current = Date.now()
      dispatch({ type: 'MOVE', direction: event.key })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.phase, dialogue, player, map, profileStatus, loadedMemberId, user?.id])

  useEffect(() => {
    if (state.phase !== 'clear' || !clearSaved) return undefined
    const timer = window.setTimeout(() => dispatch({ type: 'ENTER_NEXT_MAP' }), 1900)
    return () => window.clearTimeout(timer)
  }, [state.phase, clearSaved])

  const anonymous = !authLoading && !user
  const currentProfile = loadedMemberId === user?.id && profileStatus === 'ready'
  const creating = currentProfile && profile?.profile_status !== 'ACTIVE'
  const playing = currentProfile && profile?.profile_status === 'ACTIVE'

  return (
    <main className="oligo-world-page">
      <div className="oligo-world-frame">
      {(authLoading || (!anonymous && loadedMemberId !== user?.id) ||
        (!anonymous && profileStatus === 'loading')) ?
        <section className="oligo-world-game-shell" aria-busy="true">게임 기록을 불러오는 중...</section> :
      (profileStatus === 'error' && !anonymous) ?
        <section className="oligo-world-game-shell" role="alert">
          <h1>OLIGO WORLD</h1><p>{profileError}</p>
          <button className="oligo-world-status" type="button" onClick={() => window.location.reload()}>
            다시 시도</button>
        </section> :
      anonymous ? <section className="oligo-world-shell"
        aria-labelledby="oligo-world-title">
        <div className="oligo-world-stage">
          <img className="oligo-world-art" src={nightWorld} alt="달빛 아래 궁궐과 서울의 미래 도시 풍경" />
          <div className="oligo-world-hero-copy">
            <p className="oligo-world-eyebrow">OLIGO-K · KOREA FANTASY</p>
            <h1 className="oligo-world-title" id="oligo-world-title">OLIGO WORLD</h1>
            <p className="oligo-world-description">모험 기록은 회원 계정에 저장됩니다.<br />
              로그인 후 Oligo World를 시작해주세요.</p>
            <a className="oligo-world-status" href="/login">로그인</a>
            <a className="oligo-world-guest-hub" href="/game" onClick={navigateGame}>
              GAME HUB로 돌아가기</a>
          </div>
        </div>
      </section> : <section className="oligo-world-game-shell" aria-label="Oligo World 모험">
        <header className="oligo-world-game-header">
          <span>OLIGO WORLD</span><strong>CHAPTER 01 · 첫 걸음</strong>
        </header>
        {creating ? <CharacterSelect profile={profile} memberRegionCode={user.region_code}
          onFinalized={saved => {
            setProfile(saved)
            dispatch({ type: 'HYDRATE_PROFILE', profile: saved })
          }} /> : playing && player && map && <>
          <GameHud character={character} player={player} map={map} nickname={profile.game_nickname} />
          <div className="oligo-world-play-layout">
            <GameViewport map={map} player={player} character={character} viewportRef={viewportRef} />
            <div className="oligo-world-play-aside">
              <MissionPanel tutorial={state.tutorial} map={map} />
              <p className="oligo-world-play-hint">데스크톱에서는 방향키로 플레이할 수 있습니다.</p>
            </div>
          </div>
          {dialogue && <DialogueBox character={character} text={dialogue}
            onContinue={() => dispatch({ type: 'ADVANCE_DIALOGUE' })} />}
          {saveStatus !== 'idle' && <p className="oligo-world-progress-save" role="status">
            {saveStatus === 'saving' ? '게임 기록 저장 중...' :
              saveStatus === 'error' ? '게임 기록 저장 실패' : '게임 기록 저장됨'}</p>}
          {state.phase === 'clear' && <div className="oligo-world-clear" role="status">
            <span>{clearSaved ? 'MISSION CLEAR!' : 'MISSION CLEAR · 보상 저장 중'}</span>
            <h2>첫 걸음을 내디뎠습니다.</h2>
            {clearSaved && <p>EXP +10 <b>·</b> W +10</p>}
            {saveStatus === 'error' ? <>
              <small>보상 저장에 실패했습니다. {profileError}</small>
              <button type="button" onClick={finishTutorial}>저장 다시 시도</button>
            </> : <button type="button" disabled={!clearSaved}
              onClick={() => dispatch({ type: 'ENTER_NEXT_MAP' })}>
              {clearSaved ? '집 밖으로 나가기 →' : '보상 저장 중...'}</button>}
          </div>}
        </>}
      </section>}
      <section className="oligo-world-shell oligo-world-shell--footer" aria-label="게임 이동">
        <div className="oligo-world-footer">
          <a className="oligo-world-hub-link" href="/game" onClick={navigateGame}>← GAME HUB</a>
          <div className="oligo-world-mini-game">
            <span>MINI GAME</span>
            <a href="/game/ladder" onClick={navigateGame}>
              <LadderIcon className="oligo-world-mini-icon" />점심메뉴 사다리타기
            </a>
          </div>
          <a className="oligo-world-home-link" href="/">OLIGO-K 홈으로</a>
        </div>
      </section>
      </div>
    </main>
  )
}
