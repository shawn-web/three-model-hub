import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Spin, Result, ConfigProvider, theme as antdTheme } from 'antd'
import { Warning20 } from '../components/FluentIcon'
import { ViewerCanvas } from '../components/ViewerCanvas'
import { ViewerTree } from '../components/ViewerTree'
import { Toolbar } from '../components/Toolbar'
import { CameraInfo } from '../components/CameraInfo'
import { useMessageBus } from '../hooks/useMessageBus'
import { MESSAGE_TYPES } from '../communication/protocol'
import { useViewerStore } from '../store/viewer-store'
import { getSceneData } from '../api/scenes'
import { getModel } from '../api/models'
import { loadSceneModels } from '../utils/multi-model-loader'
import { GlbLoader } from '../loaders/glb-loader'
import type { PluginManager } from '../core/plugin-manager'

/**
 * 预览页面
 * 通过路由参数加载场景或单个模型
 * 支持 ?type=model 或 ?type=scene 参数跳过类型探测
 */
export function ViewerPage() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const [searchParams] = useSearchParams()
  const typeHint = searchParams.get('type') // 'model' | 'scene' | null
  const messageBus = useMessageBus()
  const modelLoading = useViewerStore((s) => s.modelLoading)
  const [pluginManager, setPluginManager] = useState<PluginManager | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!sceneId || loadedRef.current) return
    loadedRef.current = true

    messageBus.send(MESSAGE_TYPES.VIEWER_READY, { status: 'ok' })
    useViewerStore.getState().setSceneId(sceneId)
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
  }, [sceneId, typeHint])

  /** 作为场景加载（多模型） */
  const loadAsScene = async (sceneData: any) => {
    const store = useViewerStore.getState()
    store.setModelLoading(true)
    store.setSceneConfig(sceneData.config)

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
      (loaded, total, name) => {
        console.log(`[ViewerPage] 模型加载进度: ${loaded}/${total} - ${name}`)
      },
    )

    store.setModelObject(sceneGroup)
    store.setModelLoading(false)

    messageBus.send(MESSAGE_TYPES.MODEL_LOADED, {
      metadata: { name: sceneData.name || '场景', modelCount: sceneData.models.length },
    })
  }

  /** 作为单个模型加载 */
  const loadAsModel = async (id: string) => {
    const model = await getModel(id)
    if (!model?.file_url) {
      throw new Error('模型没有可用的文件 URL')
    }
    const store = useViewerStore.getState()
    store.setModelLoading(true)
    try {
      const loader = new GlbLoader()
      const modelObj = await loader.load(model.file_url)
      store.setModelObject(modelObj)
      store.setModelUrl(model.file_url)
      store.setModelLoading(false)
      messageBus.send(MESSAGE_TYPES.MODEL_LOADED, {
        metadata: { name: modelObj.name },
      })
    } catch (err) {
      store.setModelLoading(false)
      throw err
    }
  }

  const handleFitView = useCallback(() => {
    if (!pluginManager) return
    const navPlugin = pluginManager.getPlugin('navigation') as any
    if (navPlugin?.fitToView) navPlugin.fitToView()
  }, [pluginManager])

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#141414]">
        <Result
          status="error"
          icon={<Warning20 />}
          title={error}
        />
      </div>
    )
  }

  return (
    <ConfigProvider theme={{ algorithm: antdTheme.darkAlgorithm }}>
    <div className="w-screen h-screen relative overflow-hidden bg-[#141414]">
      <ViewerTree />
      <ViewerCanvas onPluginManagerReady={setPluginManager} />
      <CameraInfo />
      {pluginManager && <Toolbar pluginManager={pluginManager} onFitView={handleFitView} />}
      {modelLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <Spin size="large" />
          <span className="text-white/60 text-xs">加载中...</span>
        </div>
      )}
    </div>
    </ConfigProvider>
  )
}
