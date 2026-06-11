/**
 * Geo 地球页面
 * 全屏 Cesium 3D 地球视图，显示天地图底图和定位的 GLB 模型
 * Cesium 仅在此页面动态加载，不影响其他页面性能
 *
 * 支持 iframe 嵌入，通过 URL 参数和 postMessage 配置：
 * ?toolbar=false  隐藏工具栏
 * ?panel=false    隐藏模型面板
 * ?imagery=tianditu|google  底图厂商
 * ?type=satellite|vector   图层类型
 * ?allowedOrigins=origin1,origin2  允许的 postMessage 来源域名
 *
 * 配置优先级（从低到高）：
 * 1. store 默认值
 * 2. 后端 config.geo（loadMap 恢复）
 * 3. URL 参数（加载时一次性应用）
 * 4. postMessage geo-config（运行时最高优先级，不参与持久化）
 */
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Spin, Result, ConfigProvider, theme as antdTheme, Alert, Button, Tooltip, App } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { loadCesium } from '../utils/load-cesium'
import { CesiumViewer } from '../components/geo/CesiumViewer'
import { GeoModelLayer } from '../components/geo/GeoModelLayer'
import { GeoMarkerLayer } from '../components/geo/GeoMarkerLayer'
import { GeoMarkerPopup } from '../components/geo/GeoMarkerPopup'
import { GeoToolbar } from '../components/geo/GeoToolbar'
import { GeoLocationPanel } from '../components/geo/GeoLocationPanel'
import { useGeoStore } from '../store/geo-store'
import { type GeoConfigPayload } from '../communication/protocol'
import { parseUrlParams } from '../communication/url-params'
import { getMessageBus } from '../hooks/useMessageBus'
import { getThemeConfig } from '../theme'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumViewerType = any

export function GeoScenePage() {
  const { id: mapId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [viewer, setViewer] = useState<CesiumViewerType>(null)
  const viewerRef = useRef<CesiumViewerType>(null)
  const handleViewerReady = useCallback((v: CesiumViewerType) => {
    viewerRef.current = v
    setViewer(v)
  }, [])
  const [cesiumReady, setCesiumReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 是否在 iframe 中嵌入（嵌入模式下隐藏返回按钮）
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top

  // 返回地图列表（有未保存变更时弹出确认）
  const handleGoBack = async () => {
    const hasPending = useGeoStore.getState().models.some((m) => m._pendingGeo !== undefined)
    if (hasPending) {
      // 使用原生 confirm 避免 antd Modal 静态方法无法消费 context 的警告
      const save = window.confirm('你有未保存的坐标修改，是否保存后再离开？\n\n确定 = 保存并离开，取消 = 直接离开')
      if (save) {
        await useGeoStore.getState().saveAndNotify()
      }
      navigate('/maps')
    } else {
      navigate('/maps')
    }
  }

  const showToolbar = useGeoStore((s) => s.showToolbar)
  const showPanel = useGeoStore((s) => s.showPanel)
  const sceneLoading = useGeoStore((s) => s.isLoading)
  const sceneError = useGeoStore((s) => s.error)
  const storeAllowedOrigins = useGeoStore((s) => s.allowedOrigins)

  const models = useGeoStore((s) => s.models)

  // 暗色主题配置（Geo 页面始终使用暗色主题）
  const darkTheme = useMemo(() => ({
    ...getThemeConfig('dark'),
    algorithm: antdTheme.darkAlgorithm,
  }), [])

  // 允许的 postMessage 来源域名（从 URL 参数获取）
  const allowedOrigins = useMemo(() => {
    const origins = searchParams.get('allowedOrigins')
    return origins ? origins.split(',') : null
  }, [searchParams])

  // 把 URL 解析的 allowedOrigins 推到 MessageBus（覆盖构造时的默认值）

  // P1-6/7: 解析 URL 参数并应用到 store（使用 parseUrlParams 统一体系）
  useEffect(() => {
    const store = useGeoStore.getState()
    const urlParams = parseUrlParams(window.location.search)
    if (urlParams.showToolbar !== undefined) {
      store.setShowToolbar(urlParams.showToolbar)
    }
    if (urlParams.showPanel !== undefined) {
      store.setShowPanel(urlParams.showPanel)
    }
    if (urlParams.imagery) {
      store.setImageryProvider(urlParams.imagery)
    }
    if (urlParams.geoType) {
      store.setImageryType(urlParams.geoType)
    }
    if (urlParams.visibleModelIds !== undefined) {
      store.setVisibleModelIds(urlParams.visibleModelIds)
    }
    if (urlParams.hiddenTools) {
      store.setHiddenTools(urlParams.hiddenTools)
    }
    if (urlParams.showMarkers !== undefined) {
      store.setShowMarkers(urlParams.showMarkers)
    }
    if (urlParams.allowedOrigins) {
      store.setAllowedOrigins(urlParams.allowedOrigins)
      // 同步到 MessageBus
      getMessageBus().setAllowedOrigins(urlParams.allowedOrigins)
    }
    if (urlParams.camera) {
      store.flyToGeo(
        urlParams.camera.longitude,
        urlParams.camera.latitude,
        urlParams.camera.altitude,
        urlParams.camera.heading,
        urlParams.camera.pitch,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  // 监听父页面 postMessage（优先级 4：运行时最高，不参与持久化）
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // origin 校验：URL 参数优先，其次使用数据库恢复的白名单
      // 注意：与 MessageBus 不同，Geo 页面要求白名单必须显式存在；
      //   未配置白名单时拒绝所有（默认安全，不依赖 referrer 可用性）
      const effectiveAllowedOrigins = allowedOrigins || storeAllowedOrigins
      if (!effectiveAllowedOrigins || !effectiveAllowedOrigins.includes(event.origin)) return

      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'geo-config' && data.payload) {
        const config = data.payload as GeoConfigPayload
        const store = useGeoStore.getState()

        // 底图相关 → 运行时覆盖（保存时不持久化）
        if (config.imagery || config.imageryType) {
          store.applyRuntimeConfig({
            imageryProvider: config.imagery,
            imageryType: config.imageryType as 'satellite' | 'vector' | 'terrain',
          })
        }
        if (typeof config.toolbar === 'boolean') {
          store.setShowToolbar(config.toolbar)
        }
        if (typeof config.panel === 'boolean') {
          store.setShowPanel(config.panel)
        }
        if (config.hiddenTools) {
          store.setHiddenTools(config.hiddenTools)
        }
        if (typeof config.showMarkers === 'boolean') {
          store.setShowMarkers(config.showMarkers)
        }
        // P1-1: 视角控制 → 相机飞行（绕开 viewerRef 闭包问题）
        if (config.camera) {
          const cam = config.camera
          const { flyToGeo } = useGeoStore.getState()
          flyToGeo(cam.longitude, cam.latitude, cam.altitude, cam.heading, cam.pitch)
        }
        // P1-1: 模型可见性控制
        if (config.visibleModelIds !== undefined) {
          store.setVisibleModelIds(config.visibleModelIds)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [allowedOrigins, storeAllowedOrigins])

  // P0-4：unsaved changes 提示
  useEffect(() => {
    const hasPending = models.some((m) => m._pendingGeo !== undefined)
    if (!hasPending) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [models])

  // Ctrl+S 快捷键保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        const hasPending = useGeoStore.getState().models.some((m) => m._pendingGeo !== undefined)
        if (hasPending) {
          useGeoStore.getState().saveAndNotify()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 动态加载 Cesium
  useEffect(() => {
    loadCesium()
      .then(() => {
        setCesiumReady(true)
        // 通知父页面 Geo 已就绪（走 MessageBus，由其 allowlist 校验决定是否发出）
        getMessageBus().send('geo-ready', { mapId })
      })
      .catch((err) => setLoadError(err.message || 'Cesium 加载失败'))
  }, [mapId])

  if (!mapId) {
    return (
      <ConfigProvider theme={darkTheme}>
        <App>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            无效的场景 ID
          </div>
        </App>
      </ConfigProvider>
    )
  }

  if (loadError) {
    return (
      <ConfigProvider theme={darkTheme}>
        <App>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Result status="error" title="加载失败" subTitle={loadError} />
          </div>
        </App>
      </ConfigProvider>
    )
  }

  if (!cesiumReady) {
    return (
      <ConfigProvider theme={darkTheme}>
        <App>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              background: '#1a1a2e',
            }}
          >
            <Spin size="large">
              <div style={{ color: '#ccc', marginTop: 8 }}>加载 3D 地球引擎...</div>
            </Spin>
          </div>
        </App>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={darkTheme}>
      <App>
        <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
          {/* 返回按钮（iframe 嵌入模式下隐藏） */}
          {!isEmbedded && (
            <Tooltip title="返回地图列表" placement="right">
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={handleGoBack}
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  zIndex: 15,
                  color: '#fff',
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: 6,
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          )}

          <CesiumViewer mapId={mapId} onViewerReady={handleViewerReady} />
          {viewer && <GeoModelLayer viewer={viewer} />}
          {viewer && <GeoMarkerLayer viewer={viewer} />}
          {viewer && <GeoMarkerPopup viewer={viewer} />}
          {showToolbar && <GeoToolbar viewer={viewer} />}
          {showPanel && <GeoLocationPanel />}

          {/* P0-5/6：场景加载状态 */}
          {sceneLoading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 20,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              pointerEvents: 'none',
            }}>
              <Spin size="large">
                <div style={{ color: '#ccc' }}>加载场景数据...</div>
              </Spin>
            </div>
          )}

          {/* P0-5：场景加载错误展示 */}
          {sceneError && (
            <div style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              zIndex: 20, maxWidth: 500,
            }}>
              <Alert type="error" message={sceneError} closable showIcon />
            </div>
          )}
        </div>
      </App>
    </ConfigProvider>
  )
}
