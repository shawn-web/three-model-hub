/**
 * 场景编辑页面
 *
 * 提供场景的完整编辑功能：
 * - 左侧面板：模型结构、构件属性、图片配置（Tab 切换）
 * - 左侧底部：场景设置、场景模型管理、标点管理（可折叠）
 * - 中央：3D 编辑画布
 * - 底部：变换工具栏（移动/旋转/缩放/适配视图）
 * - 右下角：相机信息面板
 *
 * 支持功能：
 * - 添加/移除场景中的模型
 * - 选中构件并编辑属性
 * - 添加标点并配置弹窗
 * - 批量上传图片到场景
 * - 保存场景、截图、设为封面、预览
 */

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
import { EditPanel } from '../components/EditPanel'
import { EditToolbar } from '../components/EditToolbar'
import { EditCameraInfo } from '../components/EditCameraInfo'
import { MarkerPopupEditor } from '../components/MarkerPopup'
import { useEditStore } from '../store/edit-store'
import { getScene, getSceneData, updateScene, addModelToScene, removeSceneModel, batchUpdateSceneModels } from '../api/scenes'
import { getModel, getModels } from '../api/models'
import { loadSceneModels } from '../utils/multi-model-loader'
import { uploadFile } from '../api/upload'

const { Sider, Content } = Layout
const { Text } = Typography

/** 场景编辑页面主组件 */
export function SceneEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const modelLoading = useEditStore((s) => s.modelLoading)
  const modelLoadingProgress = useEditStore((s) => s.modelLoadingProgress)
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
  const [editingMarker, setEditingMarker] = useState<any>(null)
  const [markerPopupOpen, setMarkerPopupOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    const loadScene = async () => {
      try {
        const scene = await getScene(id)
        setSceneName(scene.name)
        setSceneConfig(scene.scene_config)

        if (scene.scene_config?.background) {
          useEditStore.getState().setBackgroundConfig(scene.scene_config.background)
        } else {
          useEditStore.getState().setBackgroundConfig({ type: 'color', color: '#1a1a2e' })
        }

        const sceneData = await getSceneData(id)
        if (sceneData.models && sceneData.models.length > 0) {
          const store = useEditStore.getState()
          store.setModelLoading(true)

          const modelNameMap: Record<string, string> = {}

          const getModelUrl = async (modelId: string): Promise<string> => {
            const modelInfo = await getModel(modelId)
            if (!modelInfo?.file_url) {
              throw new Error(`模型 ${modelId} 没有可用的文件 URL`)
            }
            if (modelInfo.name) modelNameMap[modelId] = modelInfo.name
            return modelInfo.file_url
          }

          const sceneGroup = await loadSceneModels(
            sceneData.models,
            getModelUrl,
            (loaded, total, name) => {
              const progress = Math.round((loaded / total) * 100)
              useEditStore.getState().setModelLoadingProgress(progress)
            },
          )

          store.setModelObject(sceneGroup)
          store.setModelLoading(false)

          const enriched = sceneData.models.map((sm: any) => ({
            ...sm,
            resolvedName: sm.display_name || modelNameMap[sm.model_id] || `模型 ${sm.model_id?.slice(0, 6)}`,
          }))
          setSceneModels(enriched)
        }
      } catch (err) {
        console.error('加载场景失败:', err)
        message.error('加载场景失败')
      }
      setLoading(false)
    }
    loadScene()
  }, [id])

  /** 适配视图：将相机聚焦到整个模型 */
  const handleFitView = useCallback(() => {
    const fn = useEditStore.getState().fitToViewFn
    if (fn) fn()
  }, [])

  /** 聚焦到指定模型：选中该模型并触发相机聚焦 */
  const handleFocusModel = useCallback((modelId: string) => {
    const store = useEditStore.getState()
    const root = store.modelObject
    if (!root) return

    const target = root.children.find(
      (child) => child.userData?.modelId === modelId,
    )
    if (target) {
      store.selectComponent(null)
      requestAnimationFrame(() => {
        store.selectComponent(target.uuid)
      })
    }
  }, [])

  /** 保存场景所有数据（名称、配置、模型变换、材质覆盖等） */
  const handleSaveAll = useCallback(async () => {
    if (!id) return
    setSaving(true)
    try {
      const store = useEditStore.getState()

      await updateScene(id, {
        name: sceneName,
        scene_config: {
          ...sceneConfig,
          background: store.backgroundConfig,
        },
      } as any)

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

  /** 确认并导航：如果有未保存更改则弹窗确认 */
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

  /** 预览场景：跳转到预览页面 */
  const handlePreview = useCallback(() => {
    confirmAndNavigate(`/view/${id}?type=scene`)
  }, [confirmAndNavigate, id])

  /** 返回场景列表 */
  const handleGoBack = useCallback(() => {
    confirmAndNavigate('/scenes')
  }, [confirmAndNavigate])

  /** 设为封面：截取当前视口并上传为场景缩略图 */
  const handleSetThumbnail = useCallback(async (dataUrl: string) => {
    if (!id) return
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const formData = new FormData()
      formData.append('file', blob, `scene-${id}-thumbnail.png`)
      const result = await uploadFile(formData)
      if (result.url) {
        await updateScene(id, { thumbnail_url: result.url })
        message.success('封面已设置')
      }
    } catch (err) {
      message.error('设置封面失败')
    }
  }, [id])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditStore.getState().isDirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  /** 刷新场景数据：重新加载场景模型列表和 3D 对象 */
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

  /** 打开添加模型弹窗并加载可用模型列表 */
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

  /** 从场景中移除模型 */
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
      <Sider width={300} theme="light" className="border-r border-[--ant-color-border-secondary] flex flex-col">
        <div className="py-3 px-4 border-b border-[--ant-color-border-secondary] flex items-center gap-2">
          <Button type="text" size="small" icon={<ArrowLeft20 />} onClick={handleGoBack} />
          <Input
            value={sceneName}
            onChange={(e) => setSceneName(e.target.value)}
            size="small"
            variant="borderless"
            style={{ fontWeight: 600, fontSize: 14 }}
          />
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <EditPanel
            sceneModels={sceneModels}
            onRemoveModel={handleRemoveModel}
            onOpenAddModal={handleOpenAddModal}
            onAddModel={handleAddModel}
            onEditMarker={(m) => { setEditingMarker(m); setMarkerPopupOpen(true) }}
          />
        </div>

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

      <Content className="relative bg-[#f5f5f5]">
        <EditCanvas />
        <EditToolbar
          onFitView={handleFitView}
        />
        <EditCameraInfo />
        {modelLoading && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
            <Spin size="large" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-gray-500 text-xs">
                {modelLoadingProgress > 0 ? `加载中 ${modelLoadingProgress}%` : '加载中...'}
              </span>
              {modelLoadingProgress > 0 && (
                <div style={{ width: 160, height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${modelLoadingProgress}%`, height: '100%', background: '#4a9eff', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          </div>
        )}
      </Content>
    </Layout>

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

    <MarkerPopupEditor
      marker={editingMarker}
      visible={markerPopupOpen}
      onClose={() => { setMarkerPopupOpen(false); setEditingMarker(null) }}
    />
    </>
  )
}

/** 标点列表组件：显示所有标点，支持配置弹窗和删除 */
export function MarkerList({ onEditMarker }: { onEditMarker: (marker: any) => void }) {
  const markers = useEditStore((s) => s.markers)
  const removeMarker = useEditStore((s) => s.removeMarker)
  const setAddingMarker = useEditStore((s) => s.setAddingMarker)
  const addingMarker = useEditStore((s) => s.addingMarker)

  return (
    <>
      {markers.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: '8px 0' }}>
          暂无标点
        </div>
      )}
      {markers.map((m) => (
        <div key={m.id} className="flex items-center justify-between py-1 px-2 group hover:bg-[var(--ant-color-bg-text-hover)] rounded">
          <span className="text-xs flex-1 truncate">{m.name}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
            <Button type="text" size="small" onClick={() => onEditMarker(m)} title="配置弹窗">
              <Icon icon="lucide:message-square" width={14} />
            </Button>
            <Button type="text" size="small" danger onClick={() => removeMarker(m.id)}>
              <Icon icon="lucide:trash-2" width={14} />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="dashed"
        icon={<Icon icon="lucide:map-pin" width={14} />}
        block
        size="small"
        className="mt-2"
        onClick={() => setAddingMarker(!addingMarker)}
      >
        {addingMarker ? '取消添加' : '添加标点'}
      </Button>
    </>
  )
}
