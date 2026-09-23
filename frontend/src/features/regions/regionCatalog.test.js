import assert from 'node:assert/strict'
import test from 'node:test'
import { findRegionByCode, sidoRegionsFromBoundaries, sigunguRegionsFromBoundaries } from './regionCatalog.js'

const sidoBoundaries = {
  features: [
    { properties: { region_code: '11', region_name: '서울특별시' } },
    { properties: { region_code: '26', region_name: '부산광역시' } },
    { properties: { region_code: '36', region_name: '세종특별자치시' } },
  ],
}
const sigunguBoundaries = {
  features: [
    { properties: { region_code: '11620', region_name: '서울특별시 관악구' } },
    { properties: { region_code: '11680', region_name: '서울특별시 강남구' } },
    { properties: { region_code: '26110', region_name: '부산광역시 중구' } },
    { properties: { region_code: '36110', region_name: '세종특별자치시' } },
  ],
}

test('시/도 선택지는 경계 카탈로그의 코드와 이름을 보존한다', () => {
  assert.deepEqual(sidoRegionsFromBoundaries(sidoBoundaries), [
    { sidoCode: '11', sidoName: '서울특별시' },
    { sidoCode: '26', sidoName: '부산광역시' },
    { sidoCode: '36', sidoName: '세종특별자치시' },
  ])
})

test('시/군/구 선택지는 선택한 시/도 코드로 제한하고 지역 코드를 역조회한다', () => {
  const [seoul, busan, sejong] = sidoRegionsFromBoundaries(sidoBoundaries)
  const seoulRegions = sigunguRegionsFromBoundaries(sigunguBoundaries, seoul)
  assert.deepEqual(seoulRegions.map(({ sigunguName }) => sigunguName), ['관악구', '강남구'])
  assert.equal(findRegionByCode(seoulRegions, '11620')?.regionName, '서울특별시 관악구')
  assert.equal(findRegionByCode(seoulRegions, '26110'), null)
  assert.equal(sigunguRegionsFromBoundaries(sigunguBoundaries, busan)[0].regionCode, '26110')
  assert.equal(sigunguRegionsFromBoundaries(sigunguBoundaries, sejong)[0].sigunguName, '세종특별자치시')
})
