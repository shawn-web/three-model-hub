/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cesium 3D 地球组件
 */
import { useEffect, useRef } from "react"
import { useGeoStore } from "../../store/geo-store"
import { getEffectiveGeo } from "../../store/geo-store"
import { getImageryProvider } from "../../utils/imagery-providers"
import { getCs } from "../../utils/cesium-instance"
import { focusGeoModel } from "../../utils/geo-focus"
import { getParentOrigin } from "../../communication/parent-origin"
import type { GeoMarkerData } from "../../types/geo-marker"

const CLICK_THRESHOLD = 5
const DOUBLE_CLICK_WINDOW = 250

interface CesiumViewerProps {
  mapId: string
  onViewerReady?: (viewer: any) => void
}

export function CesiumViewer({ mapId, onViewerReady }: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const savedCameraRef = useRef<{ destination: unknown; heading: number; pitch: number; roll: number } | null>(null)
  /** 标记初始视角是否已恢复，避免重复应用 */
  const viewpointAppliedRef = useRef(false)
  const { models, loadMap, updateModelGeoPosition } = useGeoStore()
  const mapData = useGeoStore((s) => s.mapData)
  const effectiveImageryProvider = useGeoStore((s) => s.runtimeOverrides?.imageryProvider ?? s.imageryProvider)
  const effectiveImageryType = useGeoStore((s) => s.runtimeOverrides?.imageryType ?? s.imageryType)
  const focusedMarkerId = useGeoStore((s) => s.focusedMarkerId)
  const markers = useGeoStore((s) => s.markers)

  useEffect(() => { loadMap(mapId) }, [mapId, loadMap])

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return
    const C = getCs()
    const store = useGeoStore.getState()
    const initProviderId = store.runtimeOverrides?.imageryProvider ?? store.imageryProvider
    const initImageryType = store.runtimeOverrides?.imageryType ?? store.imageryType
    const provider = getImageryProvider(initProviderId)
    const initBaseLayer = initImageryType === "vector" ? provider.vector() : initImageryType === "terrain" ? provider.terrain() : provider.satellite()
    const viewer = new C.Viewer(containerRef.current, {
      imageryProvider: initBaseLayer, animation: false,
      timeline: false, baseLayerPicker: false, geocoder: false,
      homeButton: false, sceneModePicker: false, navigationHelpButton: false,
      fullscreenButton: false, vrButton: false, selectionIndicator: false,
      infoBox: false, scene3DOnly: true,
    })
    ;(viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none"
    const controller = viewer.scene.screenSpaceCameraController
    controller.tiltEventTypes = [C.CameraEventType.RIGHT_DRAG]
    controller.zoomEventTypes = [C.CameraEventType.WHEEL, C.CameraEventType.PINCH]
    // 禁用 Cesium 内置的左键选中/跟踪行为，防止相机围绕模型旋转
    viewer.selectedEntity = undefined
    viewer.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_CLICK)
    viewer.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    viewerRef.current = viewer

    useGeoStore.getState()._setFlyToGeoImpl((
      lng: number, lat: number, alt: number, heading?: number, pitch?: number
    ) => {
      const C = getCs()
      viewer.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(lng, lat, alt),
        orientation: {
          heading: heading !== undefined ? C.Math.toRadians(heading) : 0,
          pitch: pitch !== undefined ? C.Math.toRadians(pitch) : C.Math.toRadians(-90),
          roll: 0,
        },
        duration: 1.5,
      })
    })

    onViewerReady?.(viewer)
    return () => {
      if (!viewer.isDestroyed?.()) viewer.destroy()
      viewerRef.current = null
    }
  }, [onViewerReady])

  // 页面加载后恢复保存的视角（仅在 viewer 和 mapData 都就绪时执行一次）
  useEffect(() => {
    const viewer = viewerRef.current
    const viewpoint = mapData?.config?.geo?.viewpoint as
      | { longitude: number; latitude: number; altitude: number; heading: number; pitch: number; roll: number }
      | undefined
    if (!viewer || !viewpoint || viewpointAppliedRef.current) return
    const C = getCs()
    viewer.camera.setView({
      destination: C.Cartesian3.fromDegrees(viewpoint.longitude, viewpoint.latitude, viewpoint.altitude),
      orientation: {
        heading: viewpoint.heading,
        pitch: viewpoint.pitch,
        roll: viewpoint.roll,
      },
    })
    viewpointAppliedRef.current = true
  }, [mapData])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const provider = getImageryProvider(effectiveImageryProvider)
    let baseLayer
    if (effectiveImageryType === "vector") {
      baseLayer = provider.vector()
    } else if (effectiveImageryType === "terrain") {
      baseLayer = provider.terrain()
    } else {
      baseLayer = provider.satellite()
    }
    const newLayer = viewer.imageryLayers.addImageryProvider(baseLayer)
    newLayer.name = "base-switch-layer"
    if (effectiveImageryType === "satellite") {
      const overlay = provider.vectorOverlay?.()
      if (overlay) {
        const refLayer = viewer.imageryLayers.addImageryProvider(overlay.provider)
        refLayer.name = "overlay-reference-layer"
        refLayer.alpha = overlay.alpha ?? 0.3
      }
    }
    if (effectiveImageryType === "terrain") {
      const overlay = provider.terrainAnnotation?.()
      if (overlay) {
        const refLayer = viewer.imageryLayers.addImageryProvider(overlay)
        refLayer.name = "overlay-reference-layer"
      }
    }
    const toRemove: unknown[] = []
    for (let i = 0; i < viewer.imageryLayers.length; i++) {
      const layer = viewer.imageryLayers.get(i)
      if (layer === newLayer) continue
      if (layer.name === "overlay-reference-layer") continue
      toRemove.push(layer)
    }
    for (const layer of toRemove) viewer.imageryLayers.remove(layer as never)
    return () => {
      if (viewer.isDestroyed?.()) return
      viewer.imageryLayers.remove(newLayer)
      for (let i = viewer.imageryLayers.length - 1; i >= 0; i--) {
        const layer = viewer.imageryLayers.get(i)
        if (layer.name === "base-switch-layer" || layer.name === "overlay-reference-layer") viewer.imageryLayers.remove(layer)
      }
    }
  }, [effectiveImageryProvider, effectiveImageryType])

  const selectedModelIdRef = useRef<string | null>(null)
  const selectedModelId = useGeoStore((s) => s.selectedModelId)
  const placementMode = useGeoStore((s) => s.placementMode)

  // 当 store 的 selectedModelId 变化时（如面板点击），同步到本地 ref
  useEffect(() => {
    selectedModelIdRef.current = selectedModelId ? `model-${selectedModelId}` : null
  }, [selectedModelId])

  // 选中已定位模型时自动飞向模型（等价于点击“回到模型”）
  const autoFocusEnabledRef = useRef(false)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !selectedModelId) {
      autoFocusEnabledRef.current = false
      return
    }
    // loadMap 阶段的首个默认选中不强制飞行，避免打开页面就大幅移动相机
    if (!autoFocusEnabledRef.current) {
      autoFocusEnabledRef.current = true
      return
    }
    focusGeoModel(viewer, selectedModelId, useGeoStore.getState().models)
  }, [selectedModelId])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const C = getCs()
    const scene = viewer.scene
    let isDragging = false
    let pointerDownPos: { x: number; y: number } | null = null
    let lastClickTime = 0
    let clickCount = 0
    let dragModelId: string | null = null
    // 拖拽偏移追踪：避免拖拽开始时模型跳动
    let dragStartGeo: { longitude: number; latitude: number; altitude: number } | null = null
    let dragStartCartographic: C.Cartographic | null = null

    function pickModel(movement: any) {
      // MOUSE_MOVE 有 endPosition，LEFT_DOWN/LEFT_UP 只有 position
      const pos = movement.endPosition || movement.position
      if (!pos) return null
      const picked = scene.pick(pos, 1, 1)
      if (!picked || !picked.id) return null
      const entity = picked.id
      if (!entity) return null
      const id: string = entity._id || entity.id || ""
      if (!id.startsWith("model-")) return null
      return id
    }

    function pickMarker(movement: any) {
      const pos = movement.endPosition || movement.position
      if (!pos) return null
      const picked = scene.pick(pos, 1, 1)
      if (!picked || !picked.id) return null
      const entity = picked.id
      const markerId = entity.properties?.geoMarkerId?.getValue?.()
      return typeof markerId === 'string' ? markerId : null
    }

    function onLeftDown(movement: any) {
      pointerDownPos = { x: movement.position.x, y: movement.position.y }
      isDragging = false
      // 锁定模型时点击直接进入 pick 流程（不参与拖拽）
      const markerId = pickMarker(movement)
      if (markerId) {
        dragModelId = null
        dragStartGeo = null
        dragStartCartographic = null
        return
      }
      const modelId = pickModel(movement)
      if (modelId) {
        const realId = modelId.replace("model-", "")
        // 锁定的模型禁止拖拽（不锁相机，让用户可自由旋转地球；不影响点击选中）
        if (useGeoStore.getState().lockedModelIds.has(realId)) {
          dragModelId = null
          dragStartGeo = null
          dragStartCartographic = null
          return
        }
        dragModelId = modelId
        // 记录拖拽起始时模型的原始位置和鼠标射线与地表的交点，用于计算偏移
        const currentModels = useGeoStore.getState().models
        const model = currentModels.find((m: any) => m.id === realId)
        const geo = model ? getEffectiveGeo(model) : null
        if (geo) {
          dragStartGeo = { longitude: geo.longitude, latitude: geo.latitude, altitude: geo.altitude }
          const ray = viewer.camera.getPickRay(movement.position)
          if (ray) {
            const cartesian = scene.globe.pick(ray, scene)
            if (cartesian) {
              dragStartCartographic = C.Cartographic.fromCartesian(cartesian)
            }
          }
        }
        // 命中模型时立即锁定相机，防止 click/drag 判定间隙（<5px）相机旋转导致 pick 偏移
        // 选中与未选中模型都需要支持拖拽，因此不区分选中状态
        scene.screenSpaceCameraController.enableRotate = false
        scene.screenSpaceCameraController.enableTilt = false
        scene.screenSpaceCameraController.enableZoom = false
      } else {
        dragModelId = null
        dragStartGeo = null
        dragStartCartographic = null
      }
    }

    function onLeftUp(movement: any) {
      // 恢复相机控制（无论是否拖拽，LEFT_UP 时都恢复）
      scene.screenSpaceCameraController.enableRotate = true
      scene.screenSpaceCameraController.enableTilt = true
      scene.screenSpaceCameraController.enableZoom = true
      if (isDragging && dragModelId) {
        useGeoStore.getState().setDraggingModel(null)
      }
      if (!pointerDownPos) return
      const dx = movement.position.x - pointerDownPos.x
      const dy = movement.position.y - pointerDownPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      // 仅在未发生拖拽且位移小于阈值时视为点击
      if (dist < CLICK_THRESHOLD && !isDragging) {
        const now = Date.now()
        clickCount = now - lastClickTime < DOUBLE_CLICK_WINDOW ? clickCount + 1 : 1
        lastClickTime = now
        if (clickCount >= 2) { clickCount = 0; handleDoubleClick(movement) }
        else { handleClick(movement) }
      }
      dragModelId = null; pointerDownPos = null
      dragStartGeo = null; dragStartCartographic = null
      isDragging = false
    }

    function onMouseMove(movement: any) {
      if (!pointerDownPos) return
      const dx = movement.endPosition.x - pointerDownPos.x
      const dy = movement.endPosition.y - pointerDownPos.y
      if (Math.sqrt(dx * dx + dy * dy) >= CLICK_THRESHOLD && !isDragging) {
        isDragging = true
        // 标记拖拽状态，供 GeoModelLayer 跳过该实体的位置更新
        if (dragModelId) {
          useGeoStore.getState().setDraggingModel(dragModelId.replace("model-", ""))
        }
      }
      if (isDragging && dragModelId) handleDrag(movement)
    }

    function handleClick(movement: any) {
      const markerId = pickMarker(movement)
      if (markerId) {
        useGeoStore.getState().triggerMarkerAction(markerId)
        return
      }
      const modelId = pickModel(movement)
      if (modelId) {
        // 已在自动聚焦后，用户后续在地球上点击模型仍希望聚焦，因此提前标记
        autoFocusEnabledRef.current = true
        const realId = modelId.replace("model-", "")
        if (selectedModelIdRef.current === modelId) {
          selectedModelIdRef.current = null
          useGeoStore.getState().setSelectedModel(null)
          useGeoStore.getState().setActivePopupTarget(null)
        } else {
          selectedModelIdRef.current = modelId
          useGeoStore.getState().setSelectedModel(realId)
          // P1-2: 发送 geo-model-clicked 事件
          window.parent.postMessage({
            type: 'geo-model-clicked',
            payload: { modelId: realId, type: 'selected' },
          }, getParentOrigin())
        }
      } else {
        if (useGeoStore.getState().addingMarker) {
          placeMarkerAtClick(movement)
        } else if (placementMode) { placeAtClick(movement) }
        else if (selectedModelIdRef.current) {
          const prevId = selectedModelIdRef.current.replace("model-", "")
          selectedModelIdRef.current = null
          useGeoStore.getState().setSelectedModel(null)
          // P1-2: 发送 geo-model-clicked 取消选中事件
          window.parent.postMessage({
            type: 'geo-model-clicked',
            payload: { modelId: prevId, type: 'deselected' },
          }, getParentOrigin())
        }
      }
    }

    function handleDoubleClick(movement: any) {
      const markerId = pickMarker(movement)
      if (markerId) {
        useGeoStore.getState().triggerMarkerAction(markerId)
        return
      }
      const modelId = pickModel(movement)
      if (modelId) {
        const realId = modelId.replace("model-", "")
        const isDeselect = selectedModelIdRef.current === modelId
        selectedModelIdRef.current = isDeselect ? null : modelId
        useGeoStore.getState().setSelectedModel(isDeselect ? null : realId)
        // P1-2: 发送 geo-model-clicked 事件
        window.parent.postMessage({
          type: 'geo-model-clicked',
          payload: { modelId: realId, type: isDeselect ? 'deselected' : 'selected' },
        }, getParentOrigin())
      }
    }

    function handleDrag(movement: any) {
      if (!dragModelId) return
      const ray = viewer.camera.getPickRay(movement.endPosition)
      if (!ray) return
      const cartesian = scene.globe.pick(ray, scene)
      if (!cartesian) return
      const currentCartographic = C.Cartographic.fromCartesian(cartesian)
      const currentLng = C.Math.toDegrees(currentCartographic.longitude)
      const currentLat = C.Math.toDegrees(currentCartographic.latitude)
      let newLng: number, newLat: number, newAlt: number
      if (dragStartGeo && dragStartCartographic) {
        // 有偏移数据时：计算增量叠加到原始位置，避免拖拽跳动
        const dLng = currentLng - C.Math.toDegrees(dragStartCartographic.longitude)
        const dLat = currentLat - C.Math.toDegrees(dragStartCartographic.latitude)
        newLng = dragStartGeo.longitude + dLng
        newLat = dragStartGeo.latitude + dLat
        newAlt = dragStartGeo.altitude
      } else {
        // 降级：偏移数据缺失时直接使用当前地面坐标
        const currentModels = useGeoStore.getState().models
        const model = currentModels.find((m: any) => m.id === dragModelId!.replace("model-", ""))
        const geo = model ? getEffectiveGeo(model) : null
        newLng = currentLng
        newLat = currentLat
        newAlt = geo?.altitude ?? 0
      }
      // 1. 更新 store（持久化数据）
      updateModelGeoPosition(dragModelId!.replace("model-", ""), {
        longitude: newLng,
        latitude: newLat,
        altitude: newAlt,
      })
      // 2. 直接更新 Cesium Entity 位置（GeoModelLayer 在 draggingModelId 期间会跳过该模型）
      const entity = viewer.entities.getById(dragModelId!)
      if (entity) {
        const pos = C.Cartesian3.fromDegrees(newLng, newLat, newAlt)
        entity.position = new C.ConstantPositionProperty(pos)
      }
    }

    function placeAtClick(movement: any) {
      const ray = viewer.camera.getPickRay(movement.position)
      if (!ray) return
      const cartesian = scene.globe.pick(ray, scene)
      if (!cartesian) return
      const cartographic = C.Cartographic.fromCartesian(cartesian)
      const lng = C.Math.toDegrees(cartographic.longitude)
      const lat = C.Math.toDegrees(cartographic.latitude)
      // globe.pick 在地图缩小时深度缓冲精度不足，cartographic.height 会出现负几千的异常值
      // 使用 globe.getHeight 获取更准确的地表高度，失败时默认 0
      const globeHeight = scene.globe.getHeight(cartographic)
      const altitude = globeHeight !== undefined && globeHeight > -500 ? globeHeight : 0
      useGeoStore.getState().placeModel({
        longitude: lng,
        latitude: lat,
        altitude,
      })
    }

    function placeMarkerAtClick(movement: any) {
      const ray = viewer.camera.getPickRay(movement.position)
      if (!ray) return
      const cartesian = scene.globe.pick(ray, scene)
      if (!cartesian) return
      const cartographic = C.Cartographic.fromCartesian(cartesian)
      const lng = C.Math.toDegrees(cartographic.longitude)
      const lat = C.Math.toDegrees(cartographic.latitude)
      // globe.pick 在地图缩小时深度缓冲精度不足，使用 globe.getHeight 获取可靠高度
      const globeHeight = scene.globe.getHeight(cartographic)
      const alt = globeHeight !== undefined && globeHeight > -500 ? globeHeight : 0
      const store = useGeoStore.getState()
      const marker: GeoMarkerData = {
        id: `marker-${Date.now()}`,
        name: `标点 ${store.markers.length + 1}`,
        longitude: lng,
        latitude: lat,
        altitude: alt,
        action: 'none',
      }
      store.addMarker(marker)
      store.setAddingMarker(false)
      // 放置后自动打开编辑配置
      store.setEditingMarkerId(marker.id)
    }

    const leftDown = new C.ScreenSpaceEventHandler(viewer.scene.canvas)
    leftDown.setInputAction(onLeftDown, C.ScreenSpaceEventType.LEFT_DOWN)
    const leftUp = new C.ScreenSpaceEventHandler(viewer.scene.canvas)
    leftUp.setInputAction(onLeftUp, C.ScreenSpaceEventType.LEFT_UP)
    const mouseMove = new C.ScreenSpaceEventHandler(viewer.scene.canvas)
    mouseMove.setInputAction(onMouseMove, C.ScreenSpaceEventType.MOUSE_MOVE)
    return () => { leftDown.destroy(); leftUp.destroy(); mouseMove.destroy() }
    // models 不能作为依赖——拖拽时 updateModelGeoPosition 会更新 models，
    // 导致 useEffect 重建事件处理器，丢失 dragModelId/isDragging 等拖拽状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementMode, updateModelGeoPosition])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (!focusedMarkerId) {
      if (savedCameraRef.current) {
        viewer.camera.flyTo({
          destination: savedCameraRef.current.destination as never,
          orientation: {
            heading: savedCameraRef.current.heading,
            pitch: savedCameraRef.current.pitch,
            roll: savedCameraRef.current.roll,
          },
          duration: 1.5,
        })
        savedCameraRef.current = null
      }
      return
    }
    const marker = markers.find((m) => m.id === focusedMarkerId)
    if (!marker) return
    const camera = viewer.camera
    savedCameraRef.current = {
      destination: camera.positionWC.clone(),
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll,
    }
    const C = getCs()
    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(marker.longitude, marker.latitude, marker.altitude + 500),
      duration: 1.5,
    })
  }, [focusedMarkerId, markers])


  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />
  )
}

export type CesiumViewerHandle = any