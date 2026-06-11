/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Geo 模型相机聚焦工具
 * 复用“回到模型”的飞行逻辑，供工具栏、模型点击等入口统一调用
 */
import { getCs } from './cesium-instance'
import type { GeoPosition } from './geo-coords'

interface FocusModelData {
  id: string
  geo_position: GeoPosition | null
  _pendingGeo?: GeoPosition | null
}

/** 获取模型当前有效坐标，避免在工具函数中引入 store 造成循环依赖 */
function getEffectiveGeo(model: FocusModelData): GeoPosition | null {
  return model._pendingGeo !== undefined ? model._pendingGeo : model.geo_position
}

/** 飞到指定 Geo 模型，优先使用 Cesium Entity 的包围盒，失败时回退到坐标飞行 */
export function focusGeoModel(
  viewer: any,
  modelId: string | null,
  models: FocusModelData[],
) {
  if (!viewer || !modelId) return

  const model = models.find((m) => m.id === modelId)
  const geo = model ? getEffectiveGeo(model) : null
  if (!geo) return

  const C = getCs()

  // 查找模型对应的 Cesium Entity（用于 viewer.flyTo 自动计算观察距离）
  let targetEntity: any = null
  for (let i = 0; i < viewer.entities.values.length; i++) {
    const entity = viewer.entities.values[i]
    if (entity.properties?.sceneModelId?.getValue?.() === modelId) {
      targetEntity = entity
      break
    }
  }

  viewer.camera.cancelFlight()

  if (targetEntity) {
    viewer.flyTo(targetEntity, {
      offset: new C.HeadingPitchRange(
        C.Math.toRadians(45),
        C.Math.toRadians(-35.264),
      ),
      duration: 1.5,
    })
    return
  }

  // 回退：无 Entity 时直接飞到坐标
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(
      geo.longitude,
      geo.latitude,
      geo.altitude + Math.max(30, 80 * (geo.scale || 1)),
    ),
    orientation: {
      heading: C.Math.toRadians(45),
      pitch: C.Math.toRadians(-35.264),
      roll: 0,
    },
    duration: 1.5,
  })
}
