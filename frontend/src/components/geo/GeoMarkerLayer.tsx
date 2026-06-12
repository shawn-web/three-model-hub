/**
 * Geo 标点图层组件
 * 将 GeoMarkerData[] 渲染为 Cesium Entity（Billboard），管理实体生命周期
 * Cesium 通过 index.html 全局加载
 */
import { useEffect, useRef } from 'react'
import { useGeoStore } from '../../store/geo-store'
import { getCs } from '../../utils/cesium-instance'

/** 默认 pin 图标缓存 */
let _defaultPinDataUrl: string | null = null

/** 用 Canvas 绘制默认红色 pin 图标（参考 MarkerSpriteShared） */
function createDefaultPinIcon(): string {
  if (_defaultPinDataUrl) return _defaultPinDataUrl
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // pin 形状：上半圆 + 下方尖角
  ctx.beginPath()
  ctx.arc(32, 22, 16, Math.PI, 0, false)
  ctx.quadraticCurveTo(48, 38, 32, 56)
  ctx.quadraticCurveTo(16, 38, 16, 22)
  ctx.closePath()
  ctx.fillStyle = '#ff4444'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()

  // 中心白色小圆
  ctx.beginPath()
  ctx.arc(32, 22, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  _defaultPinDataUrl = canvas.toDataURL('image/png')
  return _defaultPinDataUrl
}

interface GeoMarkerLayerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any
}

export function GeoMarkerLayer({ viewer }: GeoMarkerLayerProps) {
  const markers = useGeoStore((s) => s.markers)
  const focusedMarkerId = useGeoStore((s) => s.focusedMarkerId)
  const showMarkers = useGeoStore((s) => s.showMarkers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entitiesRef = useRef<Map<string, any>>(new Map())

  // 同步标点 Entity 生命周期
  useEffect(() => {
    if (!viewer || !markers) return

    const C = getCs()

    if (!showMarkers) {
      entitiesRef.current.forEach((entity) => {
        viewer.entities.remove(entity)
      })
      entitiesRef.current.clear()
      useGeoStore.getState().setActivePopupTarget(null)
      return
    }

    const currentIds = new Set(entitiesRef.current.keys())
    const newIds = new Set(markers.map((m) => m.id))

    // 删除已不存在的实体
    currentIds.forEach((id) => {
      if (!newIds.has(id)) {
        const entity = entitiesRef.current.get(id)
        if (entity) {
          viewer.entities.remove(entity)
          entitiesRef.current.delete(id)
        }
      }
    })

    // 更新/创建实体
    for (const marker of markers) {
      const existingEntity = entitiesRef.current.get(marker.id)

      if (existingEntity) {
        // 更新位置
        const position = C.Cartesian3.fromDegrees(
          marker.longitude,
          marker.latitude,
          marker.altitude,
        )
        existingEntity.position = new C.ConstantPositionProperty(position)

        // 更新图标
        if (existingEntity.billboard) {
          existingEntity.billboard.image = new C.ConstantProperty(
            marker.iconUrl || createDefaultPinIcon(),
          )
          existingEntity.billboard.scale = new C.ConstantProperty(marker.iconScale || 1.0)
        }
      } else {
        // 创建新实体
        const position = C.Cartesian3.fromDegrees(
          marker.longitude,
          marker.latitude,
          marker.altitude,
        )

        const entity = viewer.entities.add({
          name: marker.name,
          position: new C.ConstantPositionProperty(position),
          billboard: {
            image: new C.ConstantProperty(marker.iconUrl || createDefaultPinIcon()),
            scale: new C.ConstantProperty(marker.iconScale || 1.0),
            verticalOrigin: C.VerticalOrigin.BOTTOM,
            heightReference: C.HeightReference.NONE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: {
            geoMarkerId: marker.id,
          },
        })

        entitiesRef.current.set(marker.id, entity)
      }
    }
  }, [viewer, markers, showMarkers])

  // 聚焦标点高亮：放大图标 + 金色色调
  useEffect(() => {
    if (!viewer) return
    const C = getCs()
    const currentMarkers = useGeoStore.getState().markers

    entitiesRef.current.forEach((entity, id) => {
      if (!entity.billboard) return
      const isFocused = id === focusedMarkerId
      const marker = currentMarkers.find((m) => m.id === id)
      const baseScale = marker?.iconScale || 1.0
      entity.billboard.scale = new C.ConstantProperty(isFocused ? baseScale * 1.5 : baseScale)
      entity.billboard.color = isFocused
        ? new C.ConstantProperty(new C.Color(1.0, 0.85, 0.2, 1.0))
        : undefined
    })
  }, [viewer, focusedMarkerId])

  // 组件卸载时清理实体
  useEffect(() => {
    const entitiesMap = entitiesRef.current
    return () => {
      if (viewer && !viewer.isDestroyed?.()) {
        entitiesMap.forEach((entity) => {
          try { viewer.entities.remove(entity) } catch { /* 忽略 */ }
        })
        entitiesMap.clear()
      }
    }
  }, [viewer])

  return null
}
