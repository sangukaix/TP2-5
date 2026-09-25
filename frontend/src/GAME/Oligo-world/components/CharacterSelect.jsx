import { useEffect, useRef, useState } from 'react'
import { useRegionCatalog } from '../../../features/regions/useRegionCatalog'
import { findRegionByCode } from '../../../features/regions/regionCatalog'
import { characterIds, nextCharacterId, changeCreationSido,
  validCreationNickname } from '../characterCreation'
import { characters } from '../characters'
import { gameProfileApi } from '../gameProfileApi'
import { travelStyles } from '../travelStyles'
import CharacterSprite from './CharacterSprite'

export default function CharacterSelect({ profile, memberRegionCode, onFinalized }) {
  const initialRegion = profile?.region_code || memberRegionCode || ''
  const [form, setForm] = useState({
    characterId: profile?.character_id || characterIds[0],
    nickname: profile?.game_nickname || '',
    sidoCode: initialRegion.slice(0, 2), regionCode: initialRegion,
    travelStyle: profile?.travel_style || '',
  })
  const [saveStatus, setSaveStatus] = useState('idle')
  const [error, setError] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const saveTimer = useRef(null)
  const inFlight = useRef(Promise.resolve())
  const saveVersion = useRef(0)
  const mounted = useRef(true)
  const { sidoOptions, sidoStatus, sigunguOptions, sigunguStatus } = useRegionCatalog(form.sidoCode)
  const region = findRegionByCode(sigunguOptions, form.regionCode)
  const style = travelStyles.find(item => item.id === form.travelStyle)
  const nicknameValid = validCreationNickname(form.nickname)
  const complete = Boolean(characters[form.characterId] && nicknameValid && region && style)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    if (finalizing) return undefined
    const nickname = form.nickname.trim()
    if (nickname && !/^[가-힣A-Za-z0-9_]{1,16}$/.test(nickname)) return undefined
    saveTimer.current = window.setTimeout(() => {
      setSaveStatus('saving')
      setError('')
      const version = ++saveVersion.current
      const data = { character_id: form.characterId,
        game_nickname: nickname || null, region_code: form.regionCode || null,
        travel_style: form.travelStyle || null }
      const task = inFlight.current.catch(() => {}).then(() => gameProfileApi.saveDraft(data))
      inFlight.current = task
      task.then(() => { if (mounted.current && version === saveVersion.current) setSaveStatus('saved') })
        .catch((failure) => {
          if (mounted.current && version === saveVersion.current) {
            setSaveStatus('error')
            setError(failure.message)
          }
        })
    }, 800)
    return () => window.clearTimeout(saveTimer.current)
  }, [form.characterId, form.nickname, form.regionCode, form.travelStyle, finalizing])

  useEffect(() => {
    function onKeyDown(event) {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      if (event.target instanceof HTMLElement &&
          event.target.closest('input, select, textarea, button, a, [contenteditable="true"]')) return
      event.preventDefault()
      rotate(event.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function rotate(step) {
    setForm(current => {
      return { ...current, characterId: nextCharacterId(current.characterId, step) }
    })
  }

  async function finalize(event) {
    event.preventDefault()
    if (!complete || finalizing) return
    setFinalizing(true)
    setError('')
    window.clearTimeout(saveTimer.current)
    try {
      await inFlight.current.catch(() => {})
      const active = await gameProfileApi.finalize({ character_id: form.characterId,
        game_nickname: form.nickname.trim(), region_code: form.regionCode,
        travel_style: form.travelStyle })
      onFinalized(active)
    } catch (failure) {
      setError(failure.message)
      setFinalizing(false)
    }
  }

  const character = characters[form.characterId]
  return <section className="oligo-world-select" aria-labelledby="oligo-world-select-title">
    <p className="oligo-world-select-kicker">CREATE YOUR STORY</p>
    <h2 id="oligo-world-select-title">모험의 첫 장을 완성하세요</h2>
    <div className="oligo-world-creation-layout">
      <div className="oligo-world-creation-visual">
        <span className="oligo-world-creation-step">01 · 캐릭터</span>
        <h3>{character.name.toUpperCase()}</h3>
        <p>{character.title}</p>
        <CharacterSprite character={character} />
        <div className="oligo-world-carousel-controls">
          <button type="button" onClick={() => rotate(-1)} aria-label="이전 캐릭터">◀</button>
          <span aria-live="polite">{characterIds.indexOf(form.characterId) + 1} / {characterIds.length}</span>
          <button type="button" onClick={() => rotate(1)} aria-label="다음 캐릭터">▶</button>
        </div>
      </div>
      <form className="oligo-world-creation-form" onSubmit={finalize}>
        <label className="oligo-world-creation-label" htmlFor="oligo-game-nickname">
          <span>02 · 게임 닉네임</span>
          <input id="oligo-game-nickname" value={form.nickname} maxLength={16}
            onChange={event => setForm(current => ({ ...current, nickname: event.target.value }))}
            placeholder="2~16자 한글·영문·숫자·_" autoComplete="off" />
        </label>
        {form.nickname && !nicknameValid && <small className="oligo-world-creation-error">
          공백 없이 2~16자의 한글, 영문, 숫자, 밑줄을 입력해주세요.</small>}
        <fieldset className="oligo-world-creation-fieldset">
          <legend>03 · 소속 지자체</legend>
          <div className="oligo-world-creation-regions">
            <label htmlFor="oligo-game-sido">시/도</label>
            <select id="oligo-game-sido" value={form.sidoCode} disabled={sidoStatus !== 'ready'}
              onChange={event => setForm(current => changeCreationSido(current, event.target.value))}>
              <option value="">시/도 선택</option>
              {sidoOptions.map(item => <option key={item.sidoCode} value={item.sidoCode}>
                {item.sidoName}</option>)}
            </select>
            <label htmlFor="oligo-game-sigungu">시/군/구</label>
            <select id="oligo-game-sigungu" value={form.regionCode}
              disabled={!form.sidoCode || sigunguStatus !== 'ready'}
              onChange={event => setForm(current => ({ ...current, regionCode: event.target.value }))}>
              <option value="">시/군/구 선택</option>
              {sigunguOptions.map(item => <option key={item.regionCode} value={item.regionCode}>
                {item.sigunguName}</option>)}
            </select>
          </div>
          <p>선택한 지자체는 지역 랭킹과 Oligo World 점령전에 사용됩니다.</p>
          {(sidoStatus === 'error' || sigunguStatus === 'error') &&
            <small className="oligo-world-creation-error">지역 목록을 불러오지 못했습니다.</small>}
        </fieldset>
        <fieldset className="oligo-world-creation-fieldset">
          <legend>04 · 좋아하는 여행 스타일</legend>
          <div className="oligo-world-style-grid">
            {travelStyles.map(item => <button key={item.id} type="button"
              className={`oligo-world-style-chip${form.travelStyle === item.id ? ' oligo-world-style-chip--active' : ''}`}
              aria-pressed={form.travelStyle === item.id}
              onClick={() => setForm(current => ({ ...current, travelStyle: item.id }))}>
              {item.label}</button>)}
          </div>
          <p>여행 스타일은 앞으로 스킬 성장 방향과 연결됩니다.</p>
        </fieldset>
        <div className="oligo-world-creation-summary">
          <strong>모험 기록</strong>
          <span>{character.name} · {form.nickname.trim() || '닉네임 미설정'}</span>
          <span>{region?.regionName || '지역 미선택'} · {style?.label || '스타일 미선택'}</span>
        </div>
        <p className="oligo-world-save-status" role="status">{form.nickname.trim() &&
          !/^[가-힣A-Za-z0-9_]{1,16}$/.test(form.nickname.trim()) ? '닉네임 형식을 확인해주세요.' :
          saveStatus === 'saving' ? '저장 중...' :
          saveStatus === 'saved' ? '초안 저장됨' : saveStatus === 'error' ? '저장에 실패했습니다.' :
          '설정은 자동 저장됩니다.'}</p>
        {error && <p className="oligo-world-creation-error" role="alert">{error}</p>}
        <button className="oligo-world-create-button" type="submit"
          disabled={!complete || finalizing}>{finalizing ? '캐릭터 생성 중...' : '캐릭터 생성!'}</button>
      </form>
    </div>
  </section>
}
