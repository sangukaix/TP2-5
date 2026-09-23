import { useEffect, useState } from 'react'
import {
  getSidoBoundaries, getSigunguBoundaries, sidoRegionsFromBoundaries, sigunguRegionsFromBoundaries,
} from './regionCatalog'

export function useRegionCatalog(sidoCode) {
  const [sidoState, setSidoState] = useState({ status: 'loading', items: [] })
  const [sigunguState, setSigunguState] = useState({ sidoCode: '', status: 'idle', items: [] })

  useEffect(() => {
    let active = true
    getSidoBoundaries()
      .then((collection) => {
        const items = sidoRegionsFromBoundaries(collection)
        if (active) setSidoState({ status: items.length ? 'ready' : 'empty', items })
      })
      .catch(() => {
        if (active) setSidoState({ status: 'error', items: [] })
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!sidoCode || sidoState.status !== 'ready') return undefined
    const sido = sidoState.items.find((item) => item.sidoCode === sidoCode)
    if (!sido) return undefined
    let active = true
    getSigunguBoundaries(sidoCode)
      .then((collection) => {
        const items = sigunguRegionsFromBoundaries(collection, sido)
        if (active) setSigunguState({
          sidoCode, status: items.length ? 'ready' : 'empty', items,
        })
      })
      .catch(() => {
        if (active) setSigunguState({ sidoCode, status: 'error', items: [] })
      })
    return () => { active = false }
  }, [sidoCode, sidoState])

  let sigunguStatus = 'idle'
  if (sidoCode) {
    if (sidoState.status === 'error') sigunguStatus = 'error'
    else if (sidoState.status === 'empty' || (sidoState.status === 'ready'
      && !sidoState.items.some((item) => item.sidoCode === sidoCode))) sigunguStatus = 'empty'
    else sigunguStatus = sigunguState.sidoCode === sidoCode ? sigunguState.status : 'loading'
  }

  return {
    sidoOptions: sidoState.items,
    sidoStatus: sidoState.status,
    sigunguOptions: sigunguState.sidoCode === sidoCode ? sigunguState.items : [],
    sigunguStatus,
  }
}
