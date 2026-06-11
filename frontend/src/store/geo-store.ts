import { create } from 'zustand'
import { message } from 'antd'
import { getGeoMapData, saveGeoConfig, updateGeoMap, addModelToGeoMap, removeGeoMapModel } from '../api/geo-maps'
import { invalidateHttpCache } from '../api/client'
import type { GeoPosition } from '../utils/geo-coords'
import type { GeoMarkerData, PopupTarget } from '../types/geo-marker'
import { DEFAULT_PROVIDER_ID } from '../utils/imagery-providers'
import { getMessageBus } from '../hooks/useMessageBus'

/** 注册在 CesiumViewer 中的 flyTo 实现，由 flyToGeo action 调用 */
let _flyToGeoFn: ((lng: number, lat: number, alt: number, heading?: number, pitch?: number) => void) | undefined

export interface GeoSceneModel {
  id: string
  model_id: string
  display_name?: string
  transform?: Record<string, unknown> | null
  material_overrides?: Record<string, unknown> | null
  visible: boolean
  sort_order: number
  /** 模型文件下载 URL（从 getGeoMapData 直接获取，避免 N+1 请求） */
  downloadUrl: string
  /** 模型缩略图 URL */
  thumbnailUrl: string
  /** 原始模型名称 */
  modelName: string
  /** 地理定位（可编辑） */
  geo_position: GeoPosition | null
  /** 编辑中的临时 geo_position */
  _pendingGeo?: GeoPosition | null
}

/** 地图数据（来自 getGeoMapData） */
interface MapData {
  id: string
  name: string
  description?: string
  config?: {
    geo?: {
      enabled?: boolean
      origin?: {
        longitude: number
        latitude: number
        altitude: number
      }
      /** 地图厂商 ID */
      imageryProvider?: string
      /** 底图图层类型 */
      imageryType?: 'satellite' | 'vector' | 'terrain'
      /** 是否显示工具栏 */
      toolbar?: boolean
      /** 是否显示右侧面板 */
      panel?: boolean
      viewpoint?: {
        longitude: number
        latitude: number
        altitude: number
        heading: number
        pitch: number
        roll: number
      }
      /** Geo 标点列表（持久化到 config.geo.markers） */
      markers?: GeoMarkerData[]
      /** 锁定的模型 ID 列表（持久化，防止刷新后解锁） */
      lockedModelIds?: string[]
      /** 可见模型 ID 列表，null/undefined 表示不过滤 */
      visibleModelIds?: string[] | null
      /** 隐藏的 Geo 工具按钮 ID 列表 */
      hiddenTools?: string[]
      /** 是否显示标点 */
      showMarkers?: boolean
      /** 允许的 postMessage 来源域名 */
      allowedOrigins?: string[]
    }
  }
  models: Array<{
    id: string
    model_id: string
    display_name?: string
    geo_position?: GeoPosition | null
    visible: boolean
    sort_order: number
    /** 模型文件 URL（后端 getGeoMapData JOIN models 表直接返回） */
    file_url?: string | null
    /** 模型缩略图 URL */
    thumbnail_url?: string | null
    /** 原始模型名称 */
    model_name?: string | null
  }>
}

/** Geo Store 状态 */
interface GeoState {
  // ── 数据 ──
  mapId: string | null
  mapData: MapData | null
  models: GeoSceneModel[]

  // ── UI 状态 ──
  isLoading: boolean
  error: string | null
  selectedModelId: string | null
  placementMode: boolean
  /** 底图图层类型：卫星影像、路网矢量或地形图 */
  imageryType: 'satellite' | 'vector' | 'terrain'
  /** 地图厂商 ID（如 'tianditu'、'google'） */
  imageryProvider: string
  /** 当前正在拖拽的模型 ID（拖拽期间 GeoModelLayer 跳过该实体更新） */
  draggingModelId: string | null
  /** 是否显示工具栏（iframe 模式下可隐藏） */
  showToolbar: boolean
  /** 是否显示模型面板（iframe 模式下可隐藏） */
  showPanel: boolean
  /** 运行时底图覆盖（来自 postMessage，不参与持久化） */
  runtimeOverrides: {
    imageryProvider?: string
    imageryType?: 'satellite' | 'vector' | 'terrain'
  } | null

/** 正在加载中的模型 ID 集合（Cesium 加载大模型时显示 loading） */
  loadingModelIds: Set<string>
  /** 可见模型 ID 过滤（来自 postMessage P1-1） */
  visibleFilter: string[] | null
  /** 允许的 postMessage 来源域名 */
  allowedOrigins: string[] | null
  /** 锁定的模型 ID 集合（防止误拖动和编辑，持久化到 config.geo.lockedModelIds） */
  lockedModelIds: Set<string>
  /** 隐藏的 Geo 工具按钮 ID 集合 */
  hiddenTools: Set<string>
  /** 是否显示标点 */
  showMarkers: boolean

  // ── Geo 标点 ──
  /** 标点列表 */
  markers: GeoMarkerData[]
  /** 正在编辑配置的标点 ID */
  editingMarkerId: string | null
  /** 当前弹窗激活目标（标点或模型） */
  activePopupTarget: PopupTarget
  /** 是否处于添加标点模式（点击地图放置新标点） */
  addingMarker: boolean
  /** 当前聚焦（飞行定位）的标点 ID，用于侧边栏点击聚焦标点 */
  focusedMarkerId: string | null

  // ── Actions ──
  loadMap: (mapId: string) => Promise<void>
  updateModelGeoPosition: (modelId: string, geo: Partial<GeoPosition>) => void
  saveGeoPositions: () => Promise<void>
  /** 保存并显示成功/失败消息通知 */
  saveAndNotify: () => Promise<void>
  setSelectedModel: (id: string | null) => void
  setPlacementMode: (active: boolean) => void
  placeModel: (geo: { longitude: number; latitude: number; altitude: number }) => void
  setDraggingModel: (id: string | null) => void
  setImageryType: (type: 'satellite' | 'vector' | 'terrain') => void
  setImageryProvider: (providerId: string) => void
  clearModelGeoPosition: (modelId: string) => void
  setShowToolbar: (show: boolean) => void
  setShowPanel: (show: boolean) => void
  /** 应用运行时配置覆盖（来自 postMessage，不参与持久化） */
  applyRuntimeConfig: (config: { imageryProvider?: string; imageryType?: 'satellite' | 'vector' | 'terrain' }) => void
  /** 保存当前相机视角到 config.geo.viewpoint 并持久化 */
  saveViewpoint: (viewpoint: { longitude: number; latitude: number; altitude: number; heading: number; pitch: number; roll: number }) => Promise<void>
  /** 清除保存的视角（恢复自动计算模式） */
  clearViewpoint: () => Promise<void>
  /** 标记模型开始加载 */
  setModelLoading: (modelId: string) => void
  /** 标记模型加载完成 */
  setModelLoaded: (modelId: string) => void
  // ── Geo 标点 Actions ──
  /** 添加标点 */
  addMarker: (marker: GeoMarkerData) => void
  /** 删除标点 */
  removeMarker: (id: string) => void
  /** 更新标点 */
  updateMarker: (id: string, updates: Partial<GeoMarkerData>) => void
  /** 设置正在编辑配置的标点 ID */
  setEditingMarkerId: (id: string | null) => void
  /** 设置弹窗激活目标 */
  setActivePopupTarget: (target: PopupTarget) => void
  /** 设置添加标点模式 */
  setAddingMarker: (active: boolean) => void
  /** 设置聚焦标点 ID（null 取消聚焦，触发相机恢复） */
  setFocusedMarkerId: (id: string | null) => void
  flyToGeo: (longitude: number, latitude: number, altitude: number, heading?: number, pitch?: number) => void
  _setFlyToGeoImpl: (fn: (lng: number, lat: number, alt: number, heading?: number, pitch?: number) => void) => void
  setVisibleModelIds: (ids: string[] | null) => void
  /** 设置允许的 postMessage 来源域名 */
  setAllowedOrigins: (origins: string[]) => void
  /** 设置隐藏的 Geo 工具按钮 */
  setHiddenTools: (tools: string[]) => void
  /** 设置是否显示标点 */
  setShowMarkers: (show: boolean) => void
  /** 触发标点配置的点击行为 */
  triggerMarkerAction: (markerId: string) => void
  /** 添加模型到地图（调用后端 API 后重新加载） */
  addModelToMap: (modelId: string) => Promise<void>
  /** 从地图中移除模型 */
  removeModelFromMap: (mapModelId: string) => Promise<void>
  /** 切换模型锁定状态（锁定后禁止拖动和坐标编辑） */
  toggleModelLock: (modelId: string) => void
}



/** 获取模型当前有效的地理坐标（优先返回编辑中的临时坐标） */
export function getEffectiveGeo(model: { _pendingGeo?: GeoPosition | null; geo_position: GeoPosition | null }): GeoPosition | null {
  return model._pendingGeo !== undefined ? model._pendingGeo : model.geo_position
}

export const useGeoStore = create<GeoState>((set, get) => ({
  mapId: null,
  mapData: null,
  models: [],
  isLoading: false,
  error: null,
  selectedModelId: null,
  placementMode: false,
  imageryType: 'satellite',
  imageryProvider: DEFAULT_PROVIDER_ID,
  draggingModelId: null,
  showToolbar: true,
  showPanel: true,
  runtimeOverrides: null,
  loadingModelIds: new Set<string>(),
  visibleFilter: null,
  allowedOrigins: null,
  lockedModelIds: new Set<string>(),
  hiddenTools: new Set<string>(),
  showMarkers: true,

  markers: [],
  editingMarkerId: null,
  activePopupTarget: null,
  addingMarker: false,
  focusedMarkerId: null,

  /**
   * 加载地图数据（后端 getGeoMapData 已 JOIN models 表返回 file_url/thumbnail_url）
   */
  loadMap: async (mapId: string) => {
    // 防重入：相同 ID 且正在加载时跳过
    const current = get()
    if (current.isLoading && current.mapId === mapId) return

    set({ isLoading: true, error: null, mapId })
    try {
      const mapData = await getGeoMapData(mapId)

      // 直接使用后端返回的 file_url / thumbnail_url，无需逐个请求
      const models: GeoSceneModel[] = (mapData.models as MapData['models']).map((m) => ({
        id: m.id,
        model_id: m.model_id,
        display_name: m.display_name,
        visible: m.visible,
        sort_order: m.sort_order,
        downloadUrl: m.file_url || '',
        thumbnailUrl: m.thumbnail_url || '',
        modelName: m.display_name || m.model_name || m.model_id,
        geo_position: m.geo_position || null,
      }))

      // 从 config 恢复底图配置
      const geoConfig = mapData.config?.geo
      const restoredImageryProvider = geoConfig?.imageryProvider || DEFAULT_PROVIDER_ID
      const restoredImageryType = geoConfig?.imageryType || 'satellite'

      // 默认选中第一个有经纬度定位的模型（不能只 truthy 检查：全 0 的占位对象会误判）
      const firstLocatedModelId =
        models.find((m) => {
          const p = m.geo_position as GeoPosition | null
          return p && typeof p.longitude === 'number' && typeof p.latitude === 'number'
        })?.id || null

          // 保留 [] 语义：DB 显式配 [] = 拒绝一切，不应当被 || 归一成 null（用 referrer）
          const allowedOrigins = geoConfig?.allowedOrigins ?? null

      set({
        mapData,
        models,
        markers: geoConfig?.markers || [],
        showToolbar: geoConfig?.toolbar ?? true,
        showPanel: geoConfig?.panel ?? true,
        imageryProvider: restoredImageryProvider,
        imageryType: restoredImageryType as 'satellite' | 'vector' | 'terrain',
        runtimeOverrides: null,
        isLoading: false,
        selectedModelId: firstLocatedModelId,
        lockedModelIds: new Set<string>(geoConfig?.lockedModelIds || []),
        visibleFilter: geoConfig?.visibleModelIds ?? null,
        hiddenTools: new Set<string>(geoConfig?.hiddenTools || []),
        showMarkers: geoConfig?.showMarkers ?? true,
        allowedOrigins,
      })

      // 同步 allowlist 到 MessageBus（覆盖构造时的 URL 默认）
      getMessageBus().setAllowedOrigins(allowedOrigins)

      // P1-2: 发送 geo-models-loaded 事件通知父页面
      // 走 MessageBus，由其 allowlist 校验决定是否真的发出
      getMessageBus().send('geo-models-loaded', { mapId, modelCount: models.length })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '加载地图失败',
        isLoading: false,
      })
    }
  },

  /**
   * 更新模型的地理坐标（本地状态，未保存）
   */
  updateModelGeoPosition: (modelId: string, geo: Partial<GeoPosition>) => {
    set((state) => ({
      models: state.models.map((m) => {
        if (m.id !== modelId) return m
        const current = m._pendingGeo || m.geo_position || {
          longitude: 0,
          latitude: 0,
          altitude: 0,
          heading: 0,
          pitch: 0,
          roll: 0,
          scale: 1,
        }
        return {
          ...m,
          _pendingGeo: { ...current, ...geo } as GeoPosition,
        }
      }),
    }))
  },

  /**
   * 保存所有 Geo 配置到后端（统一保存：模型坐标 + 底图配置 + 视角）
   * 使用单一 API 请求保证原子性
   */
  saveGeoPositions: async () => {
    const { mapId, models } = get()
    if (!mapId) return

    set({ isLoading: true, error: null })
    try {
      // 1. 收集有变更的模型（_pendingGeo !== undefined 表示有编辑）
      const pendingModels = models
        .filter((m) => m._pendingGeo !== undefined)
        .map((m) => {
          const result: { id: string; geo_position?: GeoPosition | null } = { id: m.id }
          if (m._pendingGeo === null) {
            result.geo_position = null
          } else {
            result.geo_position = m._pendingGeo
          }
          return result
        })

      // 2. 组装底图配置
      const { mapData: currentMapData, imageryProvider: currentProvider, imageryType: currentType } = get()
      const currentGeoConfig = currentMapData?.config?.geo || {}
      const newGeoConfig = {
        ...currentGeoConfig,
        imageryProvider: currentProvider,
        imageryType: currentType,
        markers: get().markers,
        lockedModelIds: Array.from(get().lockedModelIds),
        visibleModelIds: get().visibleFilter,
        hiddenTools: Array.from(get().hiddenTools),
        showMarkers: get().showMarkers,
        allowedOrigins: get().allowedOrigins || undefined,
        toolbar: get().showToolbar,
        panel: get().showPanel,
      }

      // 3. 分支保存：仅在有模型坐标变更时走 saveGeoConfig；纯配置保存走 updateGeoMap
      //    这样既兼容尚未重启的旧后端（DTO 要求 models 非空），
      //    又能让用户切换底图/标点等纯配置操作不报错
      if (pendingModels.length > 0) {
        await saveGeoConfig(mapId, {
          models: pendingModels,
          geoConfig: newGeoConfig,
        })
      } else {
        const currentConfig = currentMapData?.config || {}
        await updateGeoMap(mapId, {
          config: { ...currentConfig, geo: newGeoConfig },
        })
      }

      // 4. 保存成功后：发送事件通知 + 同步内存状态
      // 走 MessageBus，由其 allowlist 校验决定是否真的发出
      const mapIdForEvent = get().mapId
      // 注意：必须发新值（_pendingGeo），不是旧的 m.geo_position
      const savedModels = get().models
        .filter((m) => pendingModels.some((p) => p.id === m.id))
        .map((m) => ({
          modelId: m.id,
          geo_position: m._pendingGeo !== undefined ? m._pendingGeo : m.geo_position,
        }))
      getMessageBus().send('geo-position-changed', { savedModels })
      getMessageBus().send('geo-saved', { mapId: mapIdForEvent, savedModelCount: savedModels.length })

      set((state) => ({
        models: state.models.map((m) => ({
          ...m,
          geo_position: m._pendingGeo !== undefined ? m._pendingGeo : m.geo_position,
          _pendingGeo: undefined,
        })),
        // 同步 mapData 内存中的 geo 配置
        mapData: state.mapData
          ? {
              ...state.mapData,
              config: {
                ...state.mapData.config,
                geo: newGeoConfig,
              },
            }
          : null,
        isLoading: false,
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '保存失败',
        isLoading: false,
      })
      throw err
    }
  },

  setSelectedModel: (id: string | null) => {
    // 仅取消选中时同时清除放置模式，合并为单次 set 避免中间状态
    if (id === null) {
      set({ selectedModelId: null, placementMode: false })
    } else {
      set({ selectedModelId: id })
    }
  },

  setPlacementMode: (active: boolean) => {
    set({ placementMode: active })
  },
  placeModel: (geo: { longitude: number; latitude: number; altitude: number }) => {
    const { selectedModelId, models } = get()
    // 优先使用当前选中的模型，而非搜索第一个未定位模型
    const targetId = selectedModelId || models.find((m: any) => !m.geo_position)?.id
    if (!targetId) return
    set((state: any) => ({
      models: state.models.map((m: any) =>
        m.id === targetId ? { ...m, _pendingGeo: geo } : m,
      ),
      placementMode: false,
      selectedModelId: targetId,
    }))
  },

  setDraggingModel: (id: string | null) => {
    set({ draggingModelId: id })
  },

  saveAndNotify: async () => {
    try {
      await get().saveGeoPositions()
      message.success('坐标已保存')
    } catch {
      message.error('保存失败，请重试')
    }
  },

  setImageryType: (type: 'satellite' | 'vector' | 'terrain') => {
    set({ imageryType: type })
  },

  setImageryProvider: (providerId: string) => {
    set({ imageryProvider: providerId })
  },

  /** 清除模型的地理定位 */
  clearModelGeoPosition: (modelId: string) => {
    set((state) => ({
      models: state.models.map((m) =>
        m.id === modelId ? { ...m, _pendingGeo: null } : m,
      ),
    }))
  },

  setShowToolbar: (show: boolean) => {
    set({ showToolbar: show })
  },

  setShowPanel: (show: boolean) => {
    set({ showPanel: show })
  },

  applyRuntimeConfig: (config) => {
    set((state) => ({
      runtimeOverrides: {
        ...state.runtimeOverrides,
        ...config,
      },
    }))
  },

  /** 标记模型开始加载 */
  setVisibleModelIds: (ids: string[] | null) => {
    set({ visibleFilter: ids })
  },
  flyToGeo: (longitude: number, latitude: number, altitude: number, heading?: number, pitch?: number) => {
    _flyToGeoFn?.(longitude, latitude, altitude, heading, pitch)
  },
  setAllowedOrigins: (origins: string[]) => {
    set({ allowedOrigins: origins })
  },
  setHiddenTools: (tools: string[]) => {
    set({ hiddenTools: new Set(tools) })
  },
  setShowMarkers: (show: boolean) => {
    set((state) => ({
      showMarkers: show,
      activePopupTarget: show ? state.activePopupTarget : null,
    }))
  },
  triggerMarkerAction: (markerId: string) => {
    const marker = get().markers.find((m) => m.id === markerId)
    if (!marker) return

    set({ focusedMarkerId: markerId })

    // 走 MessageBus，由其 allowlist 校验决定是否真的发出
    getMessageBus().send('marker-clicked', {
      id: marker.id,
      name: marker.name,
      position: [marker.longitude, marker.latitude, marker.altitude],
      action: marker.action,
      popup: marker.popup,
      linkUrl: marker.linkUrl,
    })

    if (marker.action === 'popup' || marker.action === 'iframe' || marker.action === 'link') {
      set({ activePopupTarget: { type: 'marker', id: marker.id } })
    } else {
      set({ activePopupTarget: null })
    }
  },
  setModelLoading: (modelId: string) => {
    set((state) => {
      const next = new Set(state.loadingModelIds)
      next.add(modelId)
      return { loadingModelIds: next }
    })
  },

  /** 标记模型加载完成 */
  setModelLoaded: (modelId: string) => {
    set((state) => {
      const next = new Set(state.loadingModelIds)
      next.delete(modelId)
      return { loadingModelIds: next }
    })
  },

  /** 保存当前相机视角到 config.geo.viewpoint 并持久化 */
  _setFlyToGeoImpl: (fn: (lng: number, lat: number, alt: number, heading?: number, pitch?: number) => void) => {
    _flyToGeoFn = fn
  },

  saveViewpoint: async (viewpoint) => {
    const { mapId, mapData } = get()
    if (!mapId || !mapData) return

    const currentConfig = mapData.config || {}
    const currentGeoConfig = currentConfig.geo || {}
    const newGeoConfig = { ...currentGeoConfig, viewpoint }
    const newMapData = {
      ...mapData,
      config: { ...currentConfig, geo: newGeoConfig },
    }

    set({ mapData: newMapData as MapData })

    try {
      await updateGeoMap(mapId, {
        config: { ...currentConfig, geo: newGeoConfig },
      })
    } catch (err) {
      // 回滚
      set({ mapData })
      throw err
    }
  },

  /** 清除保存的视角（恢复自动计算模式） */
  clearViewpoint: async () => {
    const { mapId, mapData } = get()
    if (!mapId || !mapData) return

    const currentConfig = mapData.config || {}
    const currentGeoConfig = { ...(currentConfig.geo || {}) }
    delete currentGeoConfig.viewpoint
    const newMapData = {
      ...mapData,
      config: { ...currentConfig, geo: currentGeoConfig },
    }

    set({ mapData: newMapData as MapData })

    try {
      await updateGeoMap(mapId, {
        config: { ...currentConfig, geo: currentGeoConfig },
      })
    } catch (err) {
      set({ mapData })
      throw err
    }
  },

  // ── Geo 标点 Actions ──

  addMarker: (marker: GeoMarkerData) => {
    set((state) => ({ markers: [...state.markers, marker] }))
  },

  removeMarker: (id: string) => {
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
      editingMarkerId: state.editingMarkerId === id ? null : state.editingMarkerId,
      activePopupTarget:
        state.activePopupTarget?.type === 'marker' && state.activePopupTarget.id === id
          ? null
          : state.activePopupTarget,
    }))
  },

  updateMarker: (id: string, updates: Partial<GeoMarkerData>) => {
    set((state) => ({
      markers: state.markers.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    }))
  },

  setEditingMarkerId: (id: string | null) => {
    set({ editingMarkerId: id })
  },

  setActivePopupTarget: (target: PopupTarget) => {
    set({ activePopupTarget: target })
  },

  setAddingMarker: (active: boolean) => {
    set({ addingMarker: active })
  },

  setFocusedMarkerId: (id: string | null) => {
    set({ focusedMarkerId: id })
  },

  /** 添加模型到地图 */
  addModelToMap: async (modelId: string) => {
    const { mapId } = get()
    if (!mapId) return
    try {
      await addModelToGeoMap(mapId, { model_id: modelId })
      // 清除缓存 + 重置 isLoading，确保 loadMap 拿到最新数据
      invalidateHttpCache(`/geo-maps/${mapId}`)
      set({ isLoading: false })
      await get().loadMap(mapId)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '添加模型失败', isLoading: false })
      throw err
    }
  },

  /** 从地图中移除模型 */
  removeModelFromMap: async (mapModelId: string) => {
    const { mapId } = get()
    if (!mapId) return
    set({ isLoading: true })
    try {
      await removeGeoMapModel(mapId, mapModelId)
      // 本地移除，无需重载；同时清理该模型的锁定状态
      set((state) => {
        const nextLocked = state.lockedModelIds.has(mapModelId)
          ? (() => { const s = new Set(state.lockedModelIds); s.delete(mapModelId); return s })()
          : state.lockedModelIds
        return {
          models: state.models.filter((m) => m.id !== mapModelId),
          selectedModelId: state.selectedModelId === mapModelId ? null : state.selectedModelId,
          lockedModelIds: nextLocked,
          isLoading: false,
        }
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '移除模型失败', isLoading: false })
      throw err
    }
  },

  /**
   * 切换模型锁定状态
   * 锁定后 CesiumViewer 不会进入拖拽流程，GeoLocationPanel 禁用坐标编辑
   * 锁定状态立即保存到 mapData.config.geo.lockedModelIds，刷新后仍保留
   */
  toggleModelLock: (modelId: string) => {
    let nextLocked = new Set<string>()
    let nextMapData: MapData | null = null

    set((state) => {
      nextLocked = new Set(state.lockedModelIds)
      if (nextLocked.has(modelId)) {
        nextLocked.delete(modelId)
      } else {
        nextLocked.add(modelId)
      }

      const currentConfig = state.mapData?.config || {}
      const currentGeoConfig = currentConfig.geo || {}
      nextMapData = state.mapData
        ? {
            ...state.mapData,
            config: {
              ...currentConfig,
              geo: {
                ...currentGeoConfig,
                lockedModelIds: Array.from(nextLocked),
              },
            },
          }
        : null

      return {
        lockedModelIds: nextLocked,
        mapData: nextMapData,
      }
    })

    const { mapId } = get()
    if (mapId && nextMapData) {
      updateGeoMap(mapId, { config: nextMapData.config }).catch(() => {
        message.error('锁定状态保存失败')
      })
    }
  },
}))
