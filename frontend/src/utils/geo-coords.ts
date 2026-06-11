/**
 * 地理坐标转换工具
 * 在 WGS84 经纬度坐标与本地平面坐标之间转换
 */

/**
 * 场景中心原点类型
 */
export interface GeoOrigin {
  longitude: number
  latitude: number
  altitude: number
}

/**
 * 地理定位信息
 */
export interface GeoPosition {
  longitude: number
  latitude: number
  altitude: number
  heading: number
  pitch: number
  roll: number
  scale: number
  /** index signature，兼容 TypeORM JsonConfig 类型 */
  [key: string]: unknown
}

/**
 * 本地偏移（米）→ 经纬度
 * 以场景中心为参考点，将本地 XYZ 偏移转换为 WGS84 坐标
 * @param offset [east, north, up] 米
 * @param origin 场景中心原点
 */
export function localToGeo(
  offset: [number, number, number],
  origin: GeoOrigin,
): { longitude: number; latitude: number; altitude: number } {
  // 1° 纬度 ≈ 111320 米
  // 1° 经度 ≈ 111320 × cos(latitude) 米
  const lat = origin.latitude + offset[1] / 111320
  const lng =
    origin.longitude +
    offset[0] / (111320 * Math.cos((origin.latitude * Math.PI) / 180))
  return {
    longitude: lng,
    latitude: lat,
    altitude: origin.altitude + offset[2],
  }
}

/**
 * 经纬度 → 本地偏移（米）
 * 以场景中心为参考点，将 WGS84 坐标转换为本地 XYZ 偏移
 * @param geo 地理坐标
 * @param origin 场景中心原点
 */
export function geoToLocal(
  geo: { longitude: number; latitude: number; altitude: number },
  origin: GeoOrigin,
): [number, number, number] {
  const east =
    (geo.longitude - origin.longitude) *
    111320 *
    Math.cos((origin.latitude * Math.PI) / 180)
  const north = (geo.latitude - origin.latitude) * 111320
  const up = geo.altitude - origin.altitude
  return [east, north, up]
}

/**
 * 计算一组地理坐标的几何中心
 * @param positions 地理坐标列表
 */
export function calculateCenter(
  positions: Array<{ longitude: number; latitude: number; altitude: number }>,
): GeoOrigin {
  if (positions.length === 0) {
    return { longitude: 116.397128, latitude: 39.916527, altitude: 50 }
  }

  const sumLng = positions.reduce((sum, p) => sum + p.longitude, 0)
  const sumLat = positions.reduce((sum, p) => sum + p.latitude, 0)
  const sumAlt = positions.reduce((sum, p) => sum + p.altitude, 0)

  return {
    longitude: sumLng / positions.length,
    latitude: sumLat / positions.length,
    altitude: sumAlt / positions.length,
  }
}
