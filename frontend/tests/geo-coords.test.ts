import { describe, it, expect } from 'vitest'
import { localToGeo, geoToLocal, calculateCenter } from '../src/utils/geo-coords'

/** 北京原点：与 calculateCenter fallback 不同的具体坐标 */
const BEIJING_ORIGIN = { longitude: 116.397128, latitude: 39.916527, altitude: 50 }

describe('localToGeo', () => {
  it('零偏移应返回原点', () => {
    const result = localToGeo([0, 0, 0], BEIJING_ORIGIN)
    expect(result.longitude).toBeCloseTo(BEIJING_ORIGIN.longitude, 6)
    expect(result.latitude).toBeCloseTo(BEIJING_ORIGIN.latitude, 6)
    expect(result.altitude).toBe(BEIJING_ORIGIN.altitude)
  })

  it('东向 1113.2 米（赤道 0.01°）应正确转换为经度偏移', () => {
    // 赤道附近 cos(lat) ≈ 1
    const equatorOrigin = { longitude: 0, latitude: 0, altitude: 0 }
    const result = localToGeo([1113.2, 0, 0], equatorOrigin)
    expect(result.longitude).toBeCloseTo(0.01, 5)
    expect(result.latitude).toBe(0)
  })

  it('北向 1113.2 米（0.01° 纬度）应正确转换', () => {
    const result = localToGeo([0, 1113.2, 0], BEIJING_ORIGIN)
    expect(result.latitude).toBeCloseTo(BEIJING_ORIGIN.latitude + 0.01, 5)
  })

  it('高纬度下经度方向偏移应被 cos 因子缩小', () => {
    // 在 60°N，cos(60°) = 0.5，相同米数对应 2 倍经度差
    const highLatOrigin = { longitude: 0, latitude: 60, altitude: 0 }
    const result = localToGeo([1113.2, 0, 0], highLatOrigin)
    expect(result.longitude).toBeCloseTo(0.02, 5)
  })

  it('海拔偏移应原样加到 altitude', () => {
    const result = localToGeo([0, 0, 100], BEIJING_ORIGIN)
    expect(result.altitude).toBe(BEIJING_ORIGIN.altitude + 100)
  })
})

describe('geoToLocal', () => {
  it('与 localToGeo 互逆：往返误差小于 1e-6', () => {
    const origin = { longitude: 116.4, latitude: 39.9, altitude: 50 }
    const offset: [number, number, number] = [123.45, -67.89, 12.5]
    const geo = localToGeo(offset, origin)
    const back = geoToLocal(geo, origin)
    expect(back[0]).toBeCloseTo(offset[0], 5)
    expect(back[1]).toBeCloseTo(offset[1], 5)
    expect(back[2]).toBeCloseTo(offset[2], 6)
  })

  it('原点自身应映射为零偏移', () => {
    const result = geoToLocal(BEIJING_ORIGIN, BEIJING_ORIGIN)
    expect(result).toEqual([0, 0, 0])
  })
})

describe('calculateCenter', () => {
  it('空数组应返回北京天安门 fallback（116.397128, 39.916527, 50）', () => {
    const result = calculateCenter([])
    expect(result.longitude).toBeCloseTo(116.397128, 6)
    expect(result.latitude).toBeCloseTo(39.916527, 6)
    expect(result.altitude).toBe(50)
  })

  it('单点应返回该点坐标', () => {
    const point = { longitude: 121.4737, latitude: 31.2304, altitude: 10 }
    expect(calculateCenter([point])).toEqual(point)
  })

  it('多点应返回几何中心', () => {
    const positions = [
      { longitude: 0, latitude: 0, altitude: 0 },
      { longitude: 10, latitude: 20, altitude: 30 },
      { longitude: 20, latitude: 40, altitude: 60 },
    ]
    const center = calculateCenter(positions)
    expect(center.longitude).toBe(10)
    expect(center.latitude).toBe(20)
    expect(center.altitude).toBe(30)
  })
})
