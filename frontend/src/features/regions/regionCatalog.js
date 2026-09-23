import { getSidoBoundaries as fetchSidoBoundaries, getSigunguBoundaries as fetchSigunguBoundaries } from '../../api/dashboardApi.js'

let sidoRequest
const sigunguRequests = new Map()

export function getSidoBoundaries() {
  if (!sidoRequest) {
    sidoRequest = fetchSidoBoundaries().catch((error) => {
      sidoRequest = undefined
      throw error
    })
  }
  return sidoRequest
}

export function getSigunguBoundaries(sidoCode) {
  if (!/^\d{2}$/.test(sidoCode)) return Promise.reject(new Error('시/도 코드가 올바르지 않습니다.'))
  if (!sigunguRequests.has(sidoCode)) {
    const request = fetchSigunguBoundaries(sidoCode).catch((error) => {
      sigunguRequests.delete(sidoCode)
      throw error
    })
    sigunguRequests.set(sidoCode, request)
  }
  return sigunguRequests.get(sidoCode)
}

export function sidoRegionsFromBoundaries(collection) {
  return (collection?.features ?? []).map(({ properties }) => ({
    sidoCode: properties.region_code,
    sidoName: properties.region_name,
  }))
}

export function sigunguRegionsFromBoundaries(collection, sido) {
  if (!sido) return []
  return (collection?.features ?? [])
    .filter(({ properties }) => properties.region_code.startsWith(sido.sidoCode))
    .map(({ properties }) => {
      const regionName = properties.region_name
      const prefix = `${sido.sidoName} `
      return {
        regionCode: properties.region_code,
        sidoCode: sido.sidoCode,
        sidoName: sido.sidoName,
        sigunguName: regionName.startsWith(prefix) ? regionName.slice(prefix.length) : regionName,
        regionName,
      }
    })
}

export function findRegionByCode(regions, regionCode) {
  return regions.find((region) => region.regionCode === regionCode) ?? null
}
