import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layout,
  Input,
  Button,
  List,
  Spin,
  message,
  Typography,
  Modal,
  Empty,
} from 'antd'
import { Icon } from '@iconify/react'
import { Save20, Eye20, Building20, ArrowLeft20, Add20 } from '../components/FluentIcon'
import { captureAsThumbnail, downloadScreenshot } from '../utils/screenshot'
import { EditCanvas } from '../components/EditCanvas'
import { SceneTree } from '../components/SceneTree'
import { SceneSettings } from '../components/SceneSettings'
import { ComponentProperties } from '../components/ComponentProperties'
import { EditToolbar } from '../components/EditToolbar'
import { useEditStore } from '../store/edit-store'
import { getScene, getSceneData, updateScene, addModelToScene, removeSceneModel, batchUpdateSceneModels } from '../api/scenes'
import { getModel, getModels } from '../api/models'
import { loadSceneModels } from '../utils/multi-model-loader'
import { uploadFile } from '../api/upload'

const { Sider, Content } = Layout
const { Text } = Typography

/**
 * 场景编辑页面
 * 整合现有编辑器组件，支持场景级别的配置和多模型管理
 * 加载场景中的所有模型，每个模型应用各自的变换
 */
export function SceneEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const modelLoading = useEditStore((s) => s.modelLoading)
  const isDirty = useEditStore((s) => s.isDirty)
  const [sceneName, setSceneName] = useState('')
  const [sceneConfig, setSceneConfig] = useState<any>(null)
  const [sceneModels, setSceneModels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [addingModelId, setAddingModelId] = useState<string | null>(null)

  /** 加载场景数据 */
  useEffect(() => {
    if (!id) return
    const loadScene = async () => {
      try {
        const scene = await getScene(id)
        setSceneName(scene.name)
        setSceneConfig(scene.scene_config)

        // 恢复背景配置
        if (scene.scene_config?.background) {
          useEditStore.getState().setBackgroundConfig(scene.scene_config.background)
        } else {
          useEditStore.getState().setBackgroundConfig({ type: 'color', color: '#1a1a2e' })
        }

        /* 加载场景中的所有模型 */
        const sceneData = await getSceneData(id)
        if (sceneData.models && sceneData.models.length > 0) {
          const store = useEditStore.getState()
          store.setModelLoading(true)

          /* 获取模型文件 URL 的回调函数 */
          const getModelUrl = async (modelId: string): Promise<string> => {
            const modelInfo = await getModel(modelId)
            if (!modelInfo?.file_url) {
              throw new Error(`模型 ${modelId} 没有可用的文件 URL`)
            }
            return modelInfo.file_url
          }

          /* 使用多模型加载工具加载所有模型 */
          const sceneGroup = await loadSceneModels(
            sceneData.models,
            getModelUrl,
            (loaded, total, name) => {
              /* 多模型加载进度回调 */
              console.log(`[SceneEditorPage] 模型加载进度: ${loaded}/${total} - ${name}`)
            },
          )

          store.setModelObject(sceneGroup)
          store.setModelLoading(false)
          setSceneModels(sceneData.models)
        }
      } catch (err) {
        console.error('加载场景失败:', err)
        message.error('加载场景失败')
      }
      setLoading(false)
    }
    loadScene()
  }, [id])

  /** 适配到视图 */
  const handleFitView = useCallback(() => {
    const fn = useEditStore.getState().fitToViewFn
    if (fn) fn()
  }, [])

  /** 保存所有更改 */
  const handleSaveAll = useCallback(async () => {
    if (!id) return
    setSaving(true)
    try {
      const store = useEditStore.getState()

      // 1. 保存场景基础信息
      await updateScene(id, {
        name: sceneName,
        scene_config: {
          ...sceneConfig,
          background: store.backgroundConfig,
        },
      } as any)

      // 2. 批量保存模型变换和材质
      const editData = store.editData
      const updates = sceneModels.map((sm) => {
        const modelEdits: Record<string, any> = {}
        Object.entries(editData).forEach(([uuid, data]) => {
          if (data.color || data.opacity || data.description) {
            modelEdits[uuid] = {
              color: data.color,
              opacity: data.opacity,
              description: data.description,
            }
          }
        })

        return {
          id: sm.id,
          transform: sm.transform,
          material_overrides: Object.keys(modelEdits).length > 0 ? { components: modelEdits } : undefined,
          visible: sm.visible,
        }
      })

      await batchUpdateSceneModels(id, updates)
      useEditStore.getState().setIsDirty(false)
      message.success('保存成功')
    } catch (err) {
      message.error('保存失败')
      console.error('[SceneEditor] 保存失败:', err)
    }
    setSaving(false)
  }, [id, sceneName, sceneConfig, sceneModels])

  /** 带脏检查的导航 */
  const confirmAndNavigate = useCallback((target: string) => {
    if (!useEditStore.getState().isDirty) {
      navigate(target)
      return
    }
    Modal.confirm({
      title: '未保存的更改',
      content: '你有未保存的更改，是否保存后再继续？',
      okText: '保存并继续',
      cancelText: '不保存',
      onOk: async () => {
        await handleSaveAll()
        navigate(target)
      },
      onCancel: () => navigate(target),
    })
  }, [navigate, handleSaveAll])

  const handlePreview = useCallback(() => {
    confirmAndNavigate(`/view/${id}?type=scene`)
  }, [confirmAndNavigate, id])

  const handleGoBack = useCallback(() => {
    confirmAndNavigate('/scenes')
  }, [confirmAndNavigate])

  /** 设置缩略图 */
  const handleSetThumbnail = useCallback(async (dataUrl: string) => {
    if (!id) return
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const formData = new FormData()
      formData.append('file', blob, `scene-${id}-thumbnail.png`)
      const result = await uploadFile(formData)
      if (result.url) {
        await updateScene(id, { thumbnail_url: result.url } as any)
        message.success('封面已设置')
      }
    } catch (err) {
      message.error('设置封面失败')
    }
  }, [id])

  /** beforeunload 处理 */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditStore.getState().isDirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  /** 刷新场景数据和 3D 视图 */
  const refreshScene = useCallback(async () => {
    if (!id) return
    const sceneData = await getSceneData(id)
    setSceneModels(sceneData.models || [])
    const store = useEditStore.getState()
    if (sceneData.models?.length > 0) {
      store.setModelLoading(true)
      const getModelUrl = async (modelId: string) => {
        const info = await getModel(modelId)
        if (!info?.file_url) throw new Error(`模型 ${modelId} 没有文件 URL`)
        return info.file_url
      }
      const sceneGroup = await loadSceneModels(sceneData.models, getModelUrl)
      store.setModelObject(sceneGroup)
      store.setModelLoading(false)
    } else {
      store.setModelObject(null)
    }
  }, [id])

  /** 打开添加模型弹窗 */
  const handleOpenAddModal = async () => {
    setAddModalOpen(true)
    setSearchText('')
    setModelsLoading(true)
    try {
      const result = await getModels({ limit: 100 })
      setAvailableModels(result.items || result || [])
    } catch {
      message.error('获取模型列表失败')
    }
    setModelsLoading(false)
  }

  /** 添加模型到场景 */
  const handleAddModel = async (modelId: string) => {
    if (!id) return
    setAddingModelId(modelId)
    try {
      await addModelToScene(id, { model_id: modelId })
      message.success('模型已添加')
      await refreshScene()
    } catch {
      message.error('添加模型失败')
    }
    setAddingModelId(null)
  }

  /** 从场景移除模型 */
  const handleRemoveModel = async (sceneModelId: string) => {
    if (!id) return
    try {
      await removeSceneModel(id, sceneModelId)
      message.success('模型已移除')
      await refreshScene()
    } catch {
      message.error('移除模型失败')
    }
  }

  if (loading) {
    return (
      <div className="h-full w-full flex justify-center items-center">
        <Spin size="large" tip="加载场景中..." />
      </div>
    )
  }

  return (
    <>
    <Layout className="h-full overflow-hidden">
      <Sider width={280} theme="light" className="border-r border-[--ant-color-border-secondary] flex flex-col">
        {/* 返回 + 标题 */}
        <div className="py-3 px-4 border-b border-[--ant-color-border-secondary] flex items-center gap-2">
          <Button type="text" size="small" icon={<ArrowLeft20 />} onClick={handleGoBack} />
          <Text strong className="text-sm">场景编辑</Text>
        </div>

        {/* 场景名称 */}
        <div className="py-2 px-4">
          <Input value={sceneName} onChange={(e) => setSceneName(e.target.value)} size="small" />
        </div>

        {/* 可滚动区域 */}
        <div className="flex-1 overflow-auto">
          <SceneTree />
          <SceneSettings />
          <ComponentProperties />

          {/* 场景中的模型列表 */}
          <div style={{ padding: '4px 8px' }}>
            <div style={{ padding: '8px 4px 6px', fontSize: 12, fontWeight: 600, color: 'var(--ant-color-text-secondary)', borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
              场景模型 ({sceneModels.length})
            </div>
            {sceneModels.map((sm, i) => (
              <div key={sm.id} className="flex items-center justify-between py-1 px-2">
                <span className="text-xs">{sm.display_name || `模型 ${i + 1}`}</span>
                <Button type="text" size="small" danger onClick={() => handleRemoveModel(sm.id)}>
                  <Icon icon="lucide:trash-2" width={14} />
                </Button>
              </div>
            ))}
            <Button type="dashed" icon={<Add20 />} block size="small" className="mt-2" onClick={handleOpenAddModal}>
              添加模型
            </Button>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="py-3 px-4 border-t border-[--ant-color-border-secondary]">
          <div className="flex gap-2 mb-2">
            <Button
              icon={<Icon icon="lucide:camera" width={14} />}
              size="small"
              className="flex-1"
              onClick={() => downloadScreenshot()}
            >
              截图
            </Button>
            <Button
              icon={<Icon icon="lucide:image" width={14} />}
              size="small"
              className="flex-1"
              onClick={() => {
                const dataUrl = captureAsThumbnail()
                if (dataUrl) handleSetThumbnail(dataUrl)
              }}
            >
              设为封面
            </Button>
          </div>
          <Button type="primary" icon={<Save20 />} block onClick={handleSaveAll} loading={saving}>
            保存场景
          </Button>
          <Button icon={<Eye20 />} block className="mt-2" onClick={handlePreview}>
            预览场景
          </Button>
        </div>
      </Sider>

      {/* 中央 3D 编辑器 */}
      <Content className="relative bg-[#f5f5f5]">
        <EditCanvas />
        <EditToolbar
          onFitView={handleFitView}
        />
        {modelLoading && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Spin size="large" tip="加载中..." />
          </div>
        )}
      </Content>
    </Layout>

    {/* 添加模型弹窗 */}
    <Modal
      title="添加模型到场景"
      open={addModalOpen}
      onCancel={() => setAddModalOpen(false)}
      footer={null}
      width={520}
    >
      <Input.Search
        placeholder="搜索模型..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="mb-3"
        allowClear
      />
      <Spin spinning={modelsLoading}>
        {availableModels.length > 0 ? (
          <List
            size="small"
            style={{ maxHeight: 400, overflow: 'auto' }}
            dataSource={availableModels.filter((m) =>
              !searchText || m.name?.toLowerCase().includes(searchText.toLowerCase()),
            )}
            renderItem={(model) => {
              const alreadyAdded = sceneModels.some((sm) => sm.model_id === model.id)
              return (
                <List.Item
                  actions={[
                    <Button
                      key="add"
                      type="link"
                      size="small"
                      loading={addingModelId === model.id}
                      disabled={alreadyAdded}
                      onClick={() => handleAddModel(model.id)}
                    >
                      {alreadyAdded ? '已添加' : '添加'}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Building20 />}
                    title={model.name || model.id}
                    description={model.description || ''}
                  />
                </List.Item>
              )
            }}
          />
        ) : (
          <Empty description="暂无可用模型" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Spin>
    </Modal>
    </>
  )
}
