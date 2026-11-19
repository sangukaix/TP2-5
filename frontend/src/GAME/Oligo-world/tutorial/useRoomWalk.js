import { useEffect, useState } from 'react'
import { directionKeys, walkInRoom } from './openingRoom'

export function useRoomWalk(enabled, scene, layout) {
  const [walk, setWalk] = useState({
    position: layout.spawn, facing: 'ArrowDown', walking: false, lesson: 0,
  })

  useEffect(() => {
    if (!enabled) return undefined
    const held = []
    let frame = 0
    let previousTime = null

    function tick(now) {
      const elapsed = Math.min(now - (previousTime ?? now), 32)
      previousTime = now
      const key = held.at(-1)
      if (elapsed > 0) setWalk(state => walkInRoom(state, key, elapsed * .015, layout))
      frame = requestAnimationFrame(tick)
    }

    function stop() {
      held.length = 0
      cancelAnimationFrame(frame)
      previousTime = null
      setWalk(state => state.walking ? { ...state, walking: false } : state)
    }

    function onKeyDown(event) {
      if (!Object.hasOwn(directionKeys, event.key) || event.altKey || event.ctrlKey || event.metaKey ||
          event.isComposing || (!scene.current.contains(event.target) && event.target !== document.body)) return
      event.preventDefault()
      if (event.repeat || held.includes(event.key)) return
      held.push(event.key)
      setWalk(state => walkInRoom(state, event.key, .36, layout))
      if (held.length === 1) frame = requestAnimationFrame(tick)
    }

    function onKeyUp(event) {
      const index = held.indexOf(event.key)
      if (index === -1) return
      held.splice(index, 1)
      if (held.length === 0) stop()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', stop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', stop)
    }
  }, [enabled, scene, layout])

  return walk
}
