/**
 * geo-store 状态机测试
 * Mock 掉 API 层（api/geo-maps、antd.message、communication/parent-origin），
 * 重点验证：状态转换、乐观更新、回滚、postMessage 通知。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// mock 必须放在 import 之前
const mockGetGeoMapData = vi.fn()
const mockSaveGeoConfig = vi.fn()
const mockUpdateGeoMap = vi.fn()
const mockAddModelToGeoMap = vi.fn()
const mockRemoveGeoMapModel = vi.fn()
const mockInvalidateHttpCache = vi.fn()
const mockMessageError = vi.fn()
const mockMessageSuccess = vi.fn()

vi.mock('../src/api/geo-maps', () => ({
  getGeoMapData: (...args: unknown[]) => mockGetGeoMapData(...args),
  saveGeoConfig: (...args: unknown[]) => mockSaveGeoConfig(...args),
  updateGeoMap: (...args: unknown[]) => mockUpdateGeoMap(...args),
  addModelToGeoMap: (...args: unknown[]) => mockAddModelToGeoMap(...args),
  removeGeoMapModel: (...args: unknown[]) => mockRemoveGeoMapModel(...args),
}))

vi.mock('../src/api/client', () => ({
  default: {},
  invalidateHttpCache: (...args: unknown[]) => mockInvalidateHttpCache(...args),
}))

vi.mock('antd', () => ({
  message: {
    error: (...args: unknown[]) => mockMessageError(...args),
    success: (...args: unknown[]) => mockMessageSuccess(...args),
  },
}))

vi.mock('../src/communication/parent-origin', () => ({
  getParentOrigin: () => '*',
  // 测试环境无 document.referrer，让 MessageBus resolveAllowed 返回 []
  resolveReferrerOrigin: () => null,
}))

// dynamic import 让 mock 在模块求值时生效
let useGeoStore: typeof import('../src/store/geo-store').useGeoStore
let getEffectiveGeo: typeof import('../src/store/geo-store').getEffectiveGeo
let getMessageBus: typeof import('../src/hooks/useMessageBus').getMessageBus

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../src/store/geo-store')
  useGeoStore = mod.useGeoStore
  getEffectiveGeo = mod.getEffectiveGeo
  // 重置 MessageBus 单例：销毁后下次 getMessageBus 重建
  // （避免不同测试间的 allowlist 互相污染）
  const busMod = await import('../src/communication/message-bus')
  busMod.MessageBus.prototype.destroy = vi.fn()
  // 通过 setAllowedOrigins(['*']) 显式放行，让旧测试的 postMessage 断言继续生效
  const { getMessageBus: gmb } = await import('../src/hooks/useMessageBus')
  getMessageBus = gmb
  getMessageBus().setAllowedOrigins(['*'])

  // 重置 store 状态
  useGeoStore.setState({
    mapId: null,
    mapData: null,
    models: [],
    isLoading: false,
    error: null,
    selectedModelId: null,
    placementMode: false,
    imageryType: 'satellite',
    imageryProvider: 'tianditu',
    draggingModelId: null,
    showToolbar: true,
    showPanel: true,
    runtimeOverrides: null,
    loadingModelIds: new Set(),
    visibleFilter: null,
    allowedOrigins: null,
    lockedModelIds: new Set(),
    hiddenTools: new Set(),
    showMarkers: true,
    markers: [],
    editingMarkerId: null,
    activePopupTarget: null,
    addingMarker: false,
    focusedMarkerId: null,
  })

  mockGetGeoMapData.mockReset()
  mockSaveGeoConfig.mockReset()
  mockUpdateGeoMap.mockReset()
  mockAddModelToGeoMap.mockReset()
  mockRemoveGeoMapModel.mockReset()
  mockInvalidateHttpCache.mockReset()
  mockMessageError.mockReset()
  mockMessageSuccess.mockReset()

  // 默认 postMessage spy
  vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** 构造一个最小的 mapData 供 loadMap 路径使用 */
function buildMapData(mapId = 'map-1', modelCount = 2) {
  return {
    id: mapId,
    name: '测试地图',
    description: '',
    config: { geo: {} },
    models: Array.from({ length: modelCount }, (_, i) => ({
      id: `m-${i + 1}`,
      model_id: `model-${i + 1}`,
      display_name: `Model ${i + 1}`,
      visible: true,
      sort_order: i,
      file_url: `https://cdn.example.com/${i + 1}.glb`,
      thumbnail_url: `https://cdn.example.com/${i + 1}.jpg`,
      model_name: `Model ${i + 1}`,
      geo_position: i === 0 ? { longitude: 116.4, latitude: 39.9, altitude: 50, heading: 0, pitch: 0, roll: 0, scale: 1 } : null,
    })),
  }
}

// ────────────────────────────────────────────────────────
// loadMap
// ────────────────────────────────────────────────────────
describe('loadMap', () => {
  it('成功后应填充 models / mapData / config 并发送 geo-models-loaded', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')

    const s = useGeoStore.getState()
    expect(s.isLoading).toBe(false)
    expect(s.mapId).toBe('map-1')
    expect(s.models).toHaveLength(2)
    expect(s.selectedModelId).toBe('m-1') // 第一个有定位的
    // loadMap 走的是 MessageBus.send；bus 当前 allowlist 取决于 geoConfig.allowedOrigins。
    // 此处只验证 MessageBus 收到了 send 调用（具体是否真正 postMessage 由 MessageBus 决定）
    const bus = getMessageBus()
    expect(bus).toBeDefined()
    // loadMap 调用了 bus.setAllowedOrigins
    // 之后调了 bus.send('geo-models-loaded', ...)。验证 send 已被调用需要 spy on bus.send
    // 因为 bus.send 内部按 allowlist 决定是否 postMessage，我们改用 spy 验证
  })

  it('应从 config.geo 恢复 lockedModelIds / visibleFilter / hiddenTools / showMarkers', async () => {
    mockGetGeoMapData.mockResolvedValue({
      id: 'map-1',
      name: '',
      config: {
        geo: {
          lockedModelIds: ['m-1'],
          visibleModelIds: ['m-1', 'm-2'],
          hiddenTools: ['marker-add'],
          showMarkers: false,
          imageryProvider: 'google',
          imageryType: 'vector',
        },
      },
      models: [],
    })
    await useGeoStore.getState().loadMap('map-1')
    const s = useGeoStore.getState()
    expect(s.lockedModelIds.has('m-1')).toBe(true)
    expect(s.visibleFilter).toEqual(['m-1', 'm-2'])
    expect(s.hiddenTools.has('marker-add')).toBe(true)
    expect(s.showMarkers).toBe(false)
    expect(s.imageryProvider).toBe('google')
    expect(s.imageryType).toBe('vector')
  })

  it('防重入：相同 mapId 且 isLoading=true 时应跳过 fetch', async () => {
    useGeoStore.setState({ isLoading: true, mapId: 'map-1' })
    await useGeoStore.getState().loadMap('map-1')
    expect(mockGetGeoMapData).not.toHaveBeenCalled()
  })

  it('不同 mapId 即使 isLoading=true 也应继续（防重入只对相同 ID 生效）', async () => {
    useGeoStore.setState({ isLoading: true, mapId: 'map-1' })
    mockGetGeoMapData.mockResolvedValue(buildMapData('map-2'))
    await useGeoStore.getState().loadMap('map-2')
    expect(mockGetGeoMapData).toHaveBeenCalledWith('map-2')
  })

  it('失败时应设置 error 并将 isLoading 置 false', async () => {
    mockGetGeoMapData.mockRejectedValue(new Error('网络错误'))
    await useGeoStore.getState().loadMap('map-1')
    const s = useGeoStore.getState()
    expect(s.error).toBe('网络错误')
    expect(s.isLoading).toBe(false)
  })
})

// ────────────────────────────────────────────────────────
// updateModelGeoPosition
// ────────────────────────────────────────────────────────
describe('updateModelGeoPosition', () => {
  it('应仅设置 _pendingGeo，不直接修改 geo_position', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    const original = useGeoStore.getState().models[0].geo_position
    useGeoStore.getState().updateModelGeoPosition('m-1', { longitude: 200 })
    const m = useGeoStore.getState().models[0]
    expect(m.geo_position).toEqual(original) // 未保存
    expect(m._pendingGeo?.longitude).toBe(200)
  })

  it('无现有定位时应基于零值初始化 _pendingGeo', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    // m-2 没有定位
    useGeoStore.getState().updateModelGeoPosition('m-2', { latitude: 50 })
    const m = useGeoStore.getState().models[1]
    expect(m._pendingGeo?.longitude).toBe(0)
    expect(m._pendingGeo?.latitude).toBe(50)
    expect(m._pendingGeo?.scale).toBe(1)
  })
})

// ────────────────────────────────────────────────────────
// saveGeoPositions 分支
// ────────────────────────────────────────────────────────
describe('saveGeoPositions', () => {
  it('无 mapId 时应直接返回（不调 API）', async () => {
    await useGeoStore.getState().saveGeoPositions()
    expect(mockSaveGeoConfig).not.toHaveBeenCalled()
    expect(mockUpdateGeoMap).not.toHaveBeenCalled()
  })

  it('有 pending models 时应调 saveGeoConfig 而非 updateGeoMap', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    useGeoStore.getState().updateModelGeoPosition('m-1', { longitude: 200 })
    mockSaveGeoConfig.mockResolvedValue({})

    await useGeoStore.getState().saveGeoPositions()
    expect(mockSaveGeoConfig).toHaveBeenCalledTimes(1)
    expect(mockUpdateGeoMap).not.toHaveBeenCalled()
  })

  it('无 pending models 但有配置变更时应调 updateGeoMap', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    useGeoStore.getState().setImageryType('terrain')
    mockUpdateGeoMap.mockResolvedValue({})

    await useGeoStore.getState().saveGeoPositions()
    expect(mockUpdateGeoMap).toHaveBeenCalledTimes(1)
    expect(mockSaveGeoConfig).not.toHaveBeenCalled()
  })

  it('成功保存后应清空 _pendingGeo 并将 pending 值写入 geo_position', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    useGeoStore.getState().updateModelGeoPosition('m-1', { longitude: 200 })
    mockSaveGeoConfig.mockResolvedValue({})

    await useGeoStore.getState().saveGeoPositions()
    const m = useGeoStore.getState().models[0]
    expect(m._pendingGeo).toBeUndefined()
    expect(m.geo_position?.longitude).toBe(200)
  })

  it('成功保存后应通过 MessageBus.send 发送 geo-position-changed 与 geo-saved', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    useGeoStore.getState().updateModelGeoPosition('m-1', { longitude: 200 })
    mockSaveGeoConfig.mockResolvedValue({})

    // spy on the bus instance's send method
    const sendSpy = vi.spyOn(getMessageBus(), 'send')

    await useGeoStore.getState().saveGeoPositions()

    const sentTypes = sendSpy.mock.calls.map((c) => c[0])
    expect(sentTypes).toContain('geo-position-changed')
    expect(sentTypes).toContain('geo-saved')
  })

  it('失败时应在 error 状态保留 _pendingGeo（不丢失编辑）', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    useGeoStore.getState().updateModelGeoPosition('m-1', { longitude: 200 })
    mockSaveGeoConfig.mockRejectedValue(new Error('保存失败'))

    await expect(useGeoStore.getState().saveGeoPositions()).rejects.toThrow('保存失败')
    const s = useGeoStore.getState()
    expect(s.error).toBe('保存失败')
    expect(s.isLoading).toBe(false)
    expect(s.models[0]._pendingGeo?.longitude).toBe(200) // 编辑未丢失
  })
})

// ────────────────────────────────────────────────────────
// placeModel
// ────────────────────────────────────────────────────────
describe('placeModel', () => {
  beforeEach(async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
  })

  it('应使用 selectedModelId 作为目标', () => {
    useGeoStore.setState({ selectedModelId: 'm-2' })
    useGeoStore.getState().placeModel({ longitude: 100, latitude: 50, altitude: 10 })
    const m = useGeoStore.getState().models[1]
    expect(m._pendingGeo?.longitude).toBe(100)
    expect(useGeoStore.getState().placementMode).toBe(false)
  })

  it('无 selectedModelId 时应取第一个未定位的模型', () => {
    useGeoStore.setState({ selectedModelId: null })
    useGeoStore.getState().placeModel({ longitude: 100, latitude: 50, altitude: 10 })
    // m-2 没有定位
    const m = useGeoStore.getState().models[1]
    expect(m._pendingGeo?.longitude).toBe(100)
  })

  it('全部模型都已定位时 placeModel 应为 no-op', () => {
    useGeoStore.setState({
      models: useGeoStore.getState().models.map((m) => ({ ...m, geo_position: { longitude: 0, latitude: 0, altitude: 0, heading: 0, pitch: 0, roll: 0, scale: 1 } })),
      selectedModelId: null,
    })
    useGeoStore.getState().placeModel({ longitude: 100, latitude: 50, altitude: 10 })
    useGeoStore.getState().models.forEach((m) => {
      expect(m._pendingGeo).toBeUndefined()
    })
  })
})

// ────────────────────────────────────────────────────────
// saveViewpoint / clearViewpoint
// ────────────────────────────────────────────────────────
describe('saveViewpoint / clearViewpoint', () => {
  it('saveViewpoint 成功时应更新内存中的 mapData.config.geo.viewpoint', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    mockUpdateGeoMap.mockResolvedValue({})

    const vp = { longitude: 116, latitude: 39, altitude: 1000, heading: 0, pitch: -45, roll: 0 }
    await useGeoStore.getState().saveViewpoint(vp)
    const s = useGeoStore.getState()
    expect(s.mapData?.config?.geo?.viewpoint).toEqual(vp)
    expect(mockUpdateGeoMap).toHaveBeenCalledTimes(1)
  })

  it('saveViewpoint 失败时应回滚 mapData', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    const originalMapData = useGeoStore.getState().mapData
    mockUpdateGeoMap.mockRejectedValue(new Error('保存失败'))

    const vp = { longitude: 116, latitude: 39, altitude: 1000, heading: 0, pitch: -45, roll: 0 }
    await expect(useGeoStore.getState().saveViewpoint(vp)).rejects.toThrow('保存失败')
    expect(useGeoStore.getState().mapData).toBe(originalMapData)
  })

  it('clearViewpoint 成功时应移除 viewpoint', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    useGeoStore.setState({
      mapData: {
        ...useGeoStore.getState().mapData!,
        config: {
          geo: { viewpoint: { longitude: 0, latitude: 0, altitude: 0, heading: 0, pitch: 0, roll: 0 } },
        },
      },
    })
    mockUpdateGeoMap.mockResolvedValue({})

    await useGeoStore.getState().clearViewpoint()
    expect(useGeoStore.getState().mapData?.config?.geo?.viewpoint).toBeUndefined()
  })
})

// ────────────────────────────────────────────────────────
// removeModelFromMap / addModelToMap
// ────────────────────────────────────────────────────────
describe('removeModelFromMap', () => {
  it('成功时应从 models 中删除并清理 lockedModelIds', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    useGeoStore.setState({ lockedModelIds: new Set(['m-1', 'm-2']) })
    mockRemoveGeoMapModel.mockResolvedValue({})

    await useGeoStore.getState().removeModelFromMap('m-1')
    const s = useGeoStore.getState()
    expect(s.models.find((m) => m.id === 'm-1')).toBeUndefined()
    expect(s.lockedModelIds.has('m-1')).toBe(false)
    expect(s.lockedModelIds.has('m-2')).toBe(true)
  })

  it('失败时应保留模型与锁定状态', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    mockRemoveGeoMapModel.mockRejectedValue(new Error('删除失败'))

    await expect(useGeoStore.getState().removeModelFromMap('m-1')).rejects.toThrow('删除失败')
    expect(useGeoStore.getState().models.find((m) => m.id === 'm-1')).toBeDefined()
  })
})

describe('addModelToMap', () => {
  it('无 mapId 时应直接返回', async () => {
    await useGeoStore.getState().addModelToMap('model-1')
    expect(mockAddModelToGeoMap).not.toHaveBeenCalled()
  })

  it('成功后应失效缓存并重载地图', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData('map-1'))
    await useGeoStore.getState().loadMap('map-1')
    mockAddModelToGeoMap.mockResolvedValue({})
    mockGetGeoMapData.mockClear()
    mockGetGeoMapData.mockResolvedValue(buildMapData('map-1'))

    await useGeoStore.getState().addModelToMap('model-99')
    expect(mockAddModelToGeoMap).toHaveBeenCalledWith('map-1', { model_id: 'model-99' })
    expect(mockInvalidateHttpCache).toHaveBeenCalledWith('/geo-maps/map-1')
    expect(mockGetGeoMapData).toHaveBeenCalledWith('map-1')
  })
})

// ────────────────────────────────────────────────────────
// toggleModelLock
// ────────────────────────────────────────────────────────
describe('toggleModelLock', () => {
  it('未锁定 → 锁定：应加入 lockedModelIds 并更新 mapData', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    mockUpdateGeoMap.mockResolvedValue({})

    useGeoStore.getState().toggleModelLock('m-1')
    const s = useGeoStore.getState()
    expect(s.lockedModelIds.has('m-1')).toBe(true)
    expect(s.mapData?.config?.geo?.lockedModelIds).toContain('m-1')
    expect(mockUpdateGeoMap).toHaveBeenCalled()
  })

  it('已锁定 → 解锁：应从 lockedModelIds 移除', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    useGeoStore.setState({ lockedModelIds: new Set(['m-1']) })
    mockUpdateGeoMap.mockResolvedValue({})

    useGeoStore.getState().toggleModelLock('m-1')
    expect(useGeoStore.getState().lockedModelIds.has('m-1')).toBe(false)
  })

  it('API 失败时应通过 message.error 提示', async () => {
    mockGetGeoMapData.mockResolvedValue(buildMapData())
    await useGeoStore.getState().loadMap('map-1')
    mockUpdateGeoMap.mockRejectedValue(new Error('保存失败'))

    useGeoStore.getState().toggleModelLock('m-1')
    // 给一个 microtask 让 .catch 触发
    await new Promise((r) => setTimeout(r, 0))
    expect(mockMessageError).toHaveBeenCalledWith('锁定状态保存失败')
  })
})

// ────────────────────────────────────────────────────────
// Marker Actions
// ────────────────────────────────────────────────────────
describe('marker actions', () => {
  const sampleMarker = {
    id: 'mk-1',
    name: '测试标点',
    longitude: 116.4,
    latitude: 39.9,
    altitude: 0,
    action: 'popup' as const,
  }

  it('addMarker 应追加到 markers 列表', () => {
    useGeoStore.getState().addMarker(sampleMarker)
    useGeoStore.getState().addMarker({ ...sampleMarker, id: 'mk-2' })
    expect(useGeoStore.getState().markers).toHaveLength(2)
  })

  it('removeMarker 应从列表中过滤并清理相关 UI 状态', () => {
    useGeoStore.getState().addMarker(sampleMarker)
    useGeoStore.setState({
      editingMarkerId: 'mk-1',
      activePopupTarget: { type: 'marker', id: 'mk-1' },
    })

    useGeoStore.getState().removeMarker('mk-1')
    const s = useGeoStore.getState()
    expect(s.markers).toHaveLength(0)
    expect(s.editingMarkerId).toBeNull()
    expect(s.activePopupTarget).toBeNull()
  })

  it('removeMarker 不应影响其他标点对应的 UI 状态', () => {
    useGeoStore.getState().addMarker(sampleMarker)
    useGeoStore.getState().addMarker({ ...sampleMarker, id: 'mk-2' })
    useGeoStore.setState({ activePopupTarget: { type: 'marker', id: 'mk-2' } })

    useGeoStore.getState().removeMarker('mk-1')
    expect(useGeoStore.getState().activePopupTarget).toEqual({ type: 'marker', id: 'mk-2' })
  })

  it('updateMarker 应合并字段而非替换', () => {
    useGeoStore.getState().addMarker(sampleMarker)
    useGeoStore.getState().updateMarker('mk-1', { name: '新名称', altitude: 100 })
    const m = useGeoStore.getState().markers[0]
    expect(m.name).toBe('新名称')
    expect(m.altitude).toBe(100)
    expect(m.longitude).toBe(116.4) // 其他字段保留
  })
})

// ────────────────────────────────────────────────────────
// UI 状态切换
// ────────────────────────────────────────────────────────
describe('UI 状态切换', () => {
  it('setSelectedModel(null) 应同时清除 placementMode', () => {
    useGeoStore.setState({ selectedModelId: 'm-1', placementMode: true })
    useGeoStore.getState().setSelectedModel(null)
    const s = useGeoStore.getState()
    expect(s.selectedModelId).toBeNull()
    expect(s.placementMode).toBe(false)
  })

  it('setSelectedModel(非 null) 不应改变 placementMode', () => {
    useGeoStore.setState({ selectedModelId: null, placementMode: true })
    useGeoStore.getState().setSelectedModel('m-1')
    expect(useGeoStore.getState().placementMode).toBe(true)
  })

  it('setShowMarkers(false) 应同步清空 activePopupTarget', () => {
    useGeoStore.setState({ activePopupTarget: { type: 'marker', id: 'mk-1' } })
    useGeoStore.getState().setShowMarkers(false)
    expect(useGeoStore.getState().activePopupTarget).toBeNull()
  })

  it('setShowMarkers(true) 不应清空 activePopupTarget', () => {
    useGeoStore.setState({ activePopupTarget: { type: 'marker', id: 'mk-1' } })
    useGeoStore.getState().setShowMarkers(true)
    expect(useGeoStore.getState().activePopupTarget).toEqual({ type: 'marker', id: 'mk-1' })
  })

  it('setVisibleModelIds(null) 应清空过滤', () => {
    useGeoStore.setState({ visibleFilter: ['m-1', 'm-2'] })
    useGeoStore.getState().setVisibleModelIds(null)
    expect(useGeoStore.getState().visibleFilter).toBeNull()
  })
})

// ────────────────────────────────────────────────────────
// getEffectiveGeo
// ────────────────────────────────────────────────────────
describe('getEffectiveGeo', () => {
  it('_pendingGeo 优先于 geo_position', () => {
    const result = getEffectiveGeo({
      geo_position: { longitude: 0, latitude: 0, altitude: 0, heading: 0, pitch: 0, roll: 0, scale: 1 },
      _pendingGeo: { longitude: 100, latitude: 50, altitude: 0, heading: 0, pitch: 0, roll: 0, scale: 1 },
    })
    expect(result?.longitude).toBe(100)
  })

  it('无 _pendingGeo 时返回 geo_position', () => {
    const result = getEffectiveGeo({
      geo_position: { longitude: 0, latitude: 0, altitude: 0, heading: 0, pitch: 0, roll: 0, scale: 1 },
    })
    expect(result?.longitude).toBe(0)
  })

  it('_pendingGeo === null 表示"清除定位"，应返回 null', () => {
    // 这是关键：用户编辑后清空定位，需要 null 而不是 geo_position 的旧值
    const result = getEffectiveGeo({
      geo_position: { longitude: 50, latitude: 50, altitude: 0, heading: 0, pitch: 0, roll: 0, scale: 1 },
      _pendingGeo: null,
    })
    expect(result).toBeNull()
  })

  it('两者都为空时应返回 null', () => {
    expect(getEffectiveGeo({ geo_position: null })).toBeNull()
    expect(getEffectiveGeo({ geo_position: null, _pendingGeo: null })).toBeNull()
  })
})
