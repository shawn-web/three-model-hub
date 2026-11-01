import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Spin, ConfigProvider, theme as antdTheme, Button } from 'antd'
import * as THREE from 'three'
import { Warning20 } from '../components/FluentIcon'
import { ViewerCanvas } from '../components/ViewerCanvas'
import { ViewerTree } from '../components/ViewerTree'
import { Toolbar } from '../components/Toolbar'
import { CameraInfo } from '../components/CameraInfo'
import { ViewCube } from '../components/ViewCube'
import { useMessageBus } from '../hooks/useMessageBus'
import { MESSAGE_TYPES } from '../communication/protocol'
import { useViewerStore } from '../store/viewer-store'
import { useSceneStore } from '../store/scene-store'
import { getSceneData } from '../api/scenes'
import { getModel } from '../api/models'
import { loadSceneModels } from '../utils/multi-model-loader'
import { GlbLoader } from '../loaders/glb-loader'
import { applyExternalConfig } from '../utils/scene-config'
import type { PluginManager } from '../core/plugin-manager'

/** 场景数据响应类型 */
interface SceneDataResp {
  models: Array<{
    model_id: string
    material_overrides?: { components?: Record<string, Record<string, unknown>> }
    [key: string]: unknown
  }>
  config?: Record<string, unknown>
  markers?: unknown[]
  images?: unknown[]
  name?: string
}

/**
 * 预览页面
 * 通过路由参数加载场景或单个模型
 * 支持 ?type=model 或 ?type=scene 参数跳过类型探测
 */
export function ViewerPage() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const typeHint = searchParams.get('type') // 'model' | 'scene' | null
  const messageBus = useMessageBus()
  const modelLoading = useSceneStore((s) => s.modelLoading)
  const modelLoadingProgress = useSceneStore((s) => s.modelLoadingProgress)
  const getCameraState = useSceneStore((s) => s.getCameraState)
  const setCameraState = useSceneStore((s) => s.setCameraState)
  const modelObject = useSceneStore((s) => s.modelObject)
  const viewCubeVisible = useSceneStore((s) => s.viewCubeVisible)
  const [pluginManager, setPluginManager] = useState<PluginManager | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  /** 作为场景加载（多模型） */
  const loadAsScene = useCallback(async (sceneData: SceneDataResp) => {
    const sceneStore = useSceneStore.getState()
    sceneStore.setModelLoadingProgress(0)
    sceneStore.setModelLoading(true)
    // 合并外部配置（iframe postMessage 传入的配置优先于后端配置）
    const existingConfig = useViewerStore.getState().sceneConfig || {}
    const mergedConfig = sceneData.config ? { ...sceneData.config, ...existingConfig } : existingConfig
    useViewerStore.getState().setSceneConfig(mergedConfig)

    const getModelUrl = async (modelId: string): Promise<string> => {
      const modelInfo = await getModel(modelId)
      if (!modelInfo?.file_url) {
        throw new Error(`模型 ${modelId} 没有可用的文件 URL`)
      }
      return modelInfo.file_url
    }

    const sceneGroup = await loadSceneModels(
      sceneData.models,
      getModelUrl,
      (loaded, total, _name, overallPercent) => {
        const progress = overallPercent ?? Math.round((loaded / total) * 100)
        useSceneStore.getState().setModelLoadingProgress(progress)
      },
    )

    // 根据 material_overrides 中 _deleted 标记，移除已删除的构件
    for (const sm of sceneData.models) {
      if (!sm.material_overrides?.components) continue
      for (const [key, value] of Object.entries(sm.material_overrides.components)) {
        if (!(value as Record<string, unknown>)?._deleted) continue
        const obj = sceneGroup.getObjectByName(key)
        if (obj) obj.removeFromParent()
      }
    }

    sceneStore.setModelObject(sceneGroup)
    sceneStore.setMarkers((sceneData.markers || []) as import('../types/edit-data').MarkerData[])
    sceneStore.setSceneImages((sceneData.images || []) as import('../types/edit-data').SceneMedia[])

    // 同步场景配置到 scene-store（渲染状态），使用合并后的配置（外部配置优先）
    if (mergedConfig) {
      if (mergedConfig.autoRotate != null) {
        sceneStore.setAutoRotate(mergedConfig.autoRotate as boolean)
      }
      if (mergedConfig.autoRotateAxis) {
        sceneStore.setAutoRotateAxis(mergedConfig.autoRotateAxis as 'x' | 'y' | 'z')
      }
      if (mergedConfig.autoRotateSpeed != null) {
        sceneStore.setAutoRotateSpeed(mergedConfig.autoRotateSpeed as number)
      }
      if (mergedConfig.gridVisible != null) {
        sceneStore.setGridVisible(mergedConfig.gridVisible as boolean)
      }
    }

    sceneStore.setModelLoadingProgress(100)
    setTimeout(() => {
      useSceneStore.getState().setModelLoading(false)
    }, 300)

    messageBus.send(MESSAGE_TYPES.MODEL_LOADED, {
      metadata: { name: sceneData.name || '场景', modelCount: sceneData.models.length },
    })
  }, [messageBus])

  /** 作为单个模型加载 */
  const loadAsModel = useCallback(async (id: string) => {
    const model = await getModel(id)
    if (!model?.file_url) {
      throw new Error('模型没有可用的文件 URL')
    }
    const sceneStore = useSceneStore.getState()
    sceneStore.setModelLoadingProgress(0)
    sceneStore.setModelLoading(true)
    try {
      const loader = new GlbLoader()
      const modelObj = await loader.load(model.file_url, (percent) => {
        useSceneStore.getState().setModelLoadingProgress(percent)
      })
      sceneStore.setModelObject(modelObj)
      sceneStore.setModelUrl(model.file_url)
      sceneStore.setModelLoadingProgress(100)
      setTimeout(() => {
        useSceneStore.getState().setModelLoading(false)
      }, 300)
      messageBus.send(MESSAGE_TYPES.MODEL_LOADED, {
        metadata: { name: modelObj.name },
      })
    } catch (err) {
      sceneStore.setModelLoading(false)
      throw err
    }
  }, [messageBus])

  useEffect(() => {
    if (!sceneId || loadedRef.current) return
    loadedRef.current = true

    messageBus.send(MESSAGE_TYPES.VIEWER_READY, { status: 'ok' })
    useViewerStore.getState().setSceneId(sceneId)
    useSceneStore.getState().setModelUrl(sceneId)
    useViewerStore.getState().setViewerType(typeHint === 'model' ? 'model' : typeHint === 'scene' ? 'scene' : null)

    // 读取 URL 配置：树/工具栏可见性
    const toolbar = searchParams.get('toolbar')
    const tree = searchParams.get('tree')
    if (toolbar === 'false') useViewerStore.getState().setToolbarVisible(false)
    if (tree === 'false') useViewerStore.getState().setTreeVisible(false)

    const loadData = async () => {
      try {
        // 如果明确知道是模型，直接加载模型，跳过场景探测
        if (typeHint === 'model') {
          await loadAsModel(sceneId)
          return
        }

        // 尝试作为场景加载
        const sceneData = await getSceneData(sceneId)
        if (sceneData?.models?.length > 0) {
          await loadAsScene(sceneData)
          return
        }

        // 场景数据为空，尝试作为模型
        await loadAsModel(sceneId)
      } catch {
        // 场景接口失败，回退到模型加载
        try {
          await loadAsModel(sceneId)
        } catch (err) {
          setError('加载失败，请检查模型或场景是否存在')
          console.error('加载失败:', err)
        }
      }
    }

    loadData()
  }, [sceneId, typeHint, messageBus, searchParams, loadAsModel, loadAsScene])

  // 通过 MessageBus 监听 scene-config 配置消息（origin 校验由 MessageBus allowlist 统一处理）
  useEffect(() => {
    /** 结构化校验：确保 data 含已知配置字段，避免无效消息污染 store */
    const handler = (payload: unknown) => {
      const data = payload as Record<string, unknown> | null
      // 至少包含一个已知配置字段才应用，防止无关消息触发配置重置
      if (!data || typeof data !== 'object') return
      const knownKeys = [
        'background', 'ambientIntensity', 'lightIntensity', 'lightColor',
        'autoRotate', 'autoRotateAxis', 'autoRotateSpeed', 'gridVisible',
        'viewCubeVisible', 'toolbarVisible', 'treeVisible', 'hiddenTools',
        'rotationMode', 'camera', 'markers', 'sceneImages', 'models', 'components',
      ]
      const hasKnownField = knownKeys.some((k) => k in data)
      if (!hasKnownField) return
      applyExternalConfig(data, useViewerStore.getState(), useSceneStore.getState())
    }

    messageBus.on(MESSAGE_TYPES.SCENE_CONFIG, handler)
    return () => messageBus.off(MESSAGE_TYPES.SCENE_CONFIG, handler)
  }, [messageBus])

  const handleFitView = useCallback(() => {
    const store = useSceneStore.getState()
    const modelObject = store.modelObject
    const setCameraState = store.setCameraState
    if (!modelObject || !setCameraState) return

    const box = new THREE.Box3().setFromObject(modelObject)
    // 处理空包围盒
    if (box.isEmpty() || !isFinite(box.min.x) || !isFinite(box.max.x)) {
      const dir = new THREE.Vector3(1, 1, 1).normalize()
      setCameraState({
        position: { x: dir.x * 10, y: dir.y * 10, z: dir.z * 10 },
        target: { x: 0, y: 0, z: 0 },
      })
      return
    }

    const getCameraState = store.getCameraState
    const cam = getCameraState?.()
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (cam?.fov || 50) * (Math.PI / 180)
    const cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.2

    const direction = cam
      ? new THREE.Vector3()
          .subVectors(
            new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z),
            new THREE.Vector3(cam.target.x, cam.target.y, cam.target.z)
          )
          .normalize()
      : new THREE.Vector3(1, 1, 1).normalize()

    const newPos = new THREE.Vector3().copy(center).add(direction.multiplyScalar(cameraZ))
    setCameraState({
      position: { x: newPos.x, y: newPos.y, z: newPos.z },
      target: { x: center.x, y: center.y, z: center.z },
    })
  }, [])

  if (error) {
    return (
      <ConfigProvider theme={{ algorithm: antdTheme.darkAlgorithm }}>
        <div className="w-screen h-screen flex items-center justify-center bg-[#141414]">
          <div className="max-w-md w-full mx-4">
            <div className="bg-[rgba(30,30,45,0.95)] backdrop-blur-xl rounded-2xl p-8 text-center shadow-2xl border border-[rgba(255,255,255,0.06)]">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgba(255,77,79,0.15)] flex items-center justify-center">
                <Warning20 size={32} color="#ff4d4f" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">加载失败</h2>
              <p className="text-sm text-[#aaa] mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => window.location.reload()}>重新加载</Button>
                <Button type="primary" onClick={() => navigate('/')}>返回首页</Button>
              </div>
            </div>
          </div>
        </div>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={{ algorithm: antdTheme.darkAlgorithm }}>
    <div className="w-screen h-screen relative overflow-hidden bg-[#141414]">
      <ViewerTree />
      <ViewerCanvas onPluginManagerReady={setPluginManager} />
      {!modelLoading && modelObject && (
        <>
          {viewCubeVisible && <ViewCube getCameraState={getCameraState} setCameraState={setCameraState} modelObject={modelObject} />}
          {pluginManager && <Toolbar pluginManager={pluginManager} onFitView={handleFitView} />}
        </>
      )}
      <CameraInfo />
      {modelLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
          <Spin size="large" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-white/60 text-xs">
              {modelLoadingProgress >= 100 ? '渲染中...' : modelLoadingProgress > 0 ? `加载中 ${modelLoadingProgress}%` : '加载中...'}
            </span>
            {modelLoadingProgress > 0 && modelLoadingProgress < 100 ? (
              <div style={{ width: 160, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${modelLoadingProgress}%`, height: '100%', background: '#4a9eff', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            ) : (
              <div style={{ width: 160, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  position: 'absolute', width: '40%', height: '100%', background: '#4a9eff', borderRadius: 2,
                  animation: 'indeterminate 1.5s infinite ease-in-out',
                }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </ConfigProvider>
  )
}
