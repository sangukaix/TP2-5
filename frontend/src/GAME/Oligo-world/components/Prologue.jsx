import { useCallback, useEffect, useRef, useState } from 'react'
import day from '../images/Oligo_bg1.png'
import sunset from '../images/Oligo_bg2.png'
import night from '../images/Oligo_bg3.png'
import mountain from '../images/mountain1.png'
import firstLogo from '../../../assets/Oligo_World_1.png'
import secondLogo from '../../../assets/Oligo_World_2.png'

const scenes = [day, sunset, night, mountain]
const logos = [firstLogo, secondLogo]
const mountainStart = 7000
const fadeStarts = [2000, 4500, mountainStart]
const logoInterval = 1000
const loadingStart = 10500
const end = 11500
const fraction = value => Math.max(0, Math.min(1, value))

export default function Prologue({ onComplete }) {
  const root = useRef(null)
  const finished = useRef(false)
  const [time, setTime] = useState(null)
  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onComplete()
  }, [onComplete])

  useEffect(() => {
    let cancelled = false
    let frame
    let start
    let previous
    function tick(now) {
      if (cancelled || finished.current) return
      start ??= now
      const elapsed = now - start
      if (elapsed >= end) {
        finish()
        return
      }
      // Show the terminal dot on the last display frame without extending loading.
      const frameLength = Math.min(now - (previous ?? now), 34)
      setTime(elapsed + frameLength >= end ? end : elapsed)
      previous = now
      frame = requestAnimationFrame(tick)
    }
    Promise.all(Array.from(root.current.querySelectorAll('img'), img => img.decode()))
      .then(() => { if (!cancelled) frame = requestAnimationFrame(tick) })
      .catch(() => { if (!cancelled) finish() })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [finish])

  const showingPhotos = time !== null && time < loadingStart
  const progress = fadeStarts.map(start => fraction((time - start) / 500))
  // Keep the logo from just before the mountain transition, even at a swap boundary.
  const logoTime = Math.min(time ?? 0, mountainStart - 1)
  const logoIndex = Math.floor(logoTime / logoInterval) % logos.length
  const logoOpacity = .82 * fraction(1 - (time - mountainStart) / 1000)
  return <main ref={root} className="oligo-world-prologue" aria-label="프롤로그">
    <div className="oligo-prologue-photos" aria-hidden="true" style={{ visibility: showingPhotos ? 'visible' : 'hidden' }}>
      {scenes.map((src, index) => <img key={src} src={src} alt=""
        style={{ opacity: (progress[index - 1] ?? 1) - (progress[index] ?? 0) }} />)}
    </div>
    <div className="oligo-prologue-logos" aria-hidden="true" style={{ visibility: showingPhotos ? 'visible' : 'hidden' }}>
      {logos.map((src, index) => <img key={src} src={src} alt=""
        style={{ opacity: index === logoIndex ? logoOpacity : 0 }} />)}
    </div>
    {time >= loadingStart && <p className="oligo-prologue-loading">
      Now Loading{'.'.repeat(2 + Math.floor((time - loadingStart) / 200))}
    </p>}
    <button type="button" autoFocus onClick={finish}>SKIP</button>
  </main>
}
