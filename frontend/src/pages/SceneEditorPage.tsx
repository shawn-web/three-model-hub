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

import { useEffect, useState, useCallback, useRef } from 'react'
import * as THREE from 'three'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layout,
  Input,
  Button,
  List,
  Spin,
  message,
  Modal,
  Empty,
} from 'antd'
import { Icon } from '@iconify/react'
import { fileCode2Icon, cameraIcon, imageIcon } from '../components/Icons'
import { Save20, Eye20, Building20, ArrowLeft20 } from '../components/FluentIcon'
import { captureAsThumbnail, downloadScreenshot } from '../utils/screenshot'
import { EditCanvas } from '../components/EditCanvas'
import { EditPanel } from '../components/EditPanel'
import { EditToolbar } from '../components/EditToolbar'
import { CameraInfo } from '../components/CameraInfo'
import { ViewCube } from '../components/ViewCube'
import { MarkerConfigPanel } from '../components/MarkerConfigPanel'
import { ConfigEditModal } from '../components/ConfigEditModal'
import { ThumbnailCropModal } from '../components/ThumbnailCropModal'
import { useEditStore } from '../store/edit-store'
import { useSceneStore } from '../store/scene-store'
import { getScene, getSceneData, updateScene, addModelToScene, removeSceneModel, batchUpdateSceneModels, batchSaveSceneImages } from '../api/scenes'
import { getModel, getModels } from '../api/models'
import { loadSceneModels, loadGLBWithCache, getNodePath } from '../utils/multi-model-loader'
import { uploadFile } from '../api/upload'
import { invalidateHttpCache } from '../api/client'

const { Sider, Content } = Layout

/** 场景配置类型 */
interface SceneConfig {
  camera?: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov: number }
  background?: Record<string, unknown>
  ambientIntensity?: number
  lightIntensity?: number
  lightColor?: string
  autoRotate?: boolean
  autoRotateAxis?: string
  autoRotateSpeed?: number
  gridVisible?: boolean
}

/** 场景中的模型条目 */
interface SceneModelEntry {
  id: string
  model_id: string
  display_name?: string
  transform?: { position?: number[]; rotation?: number[]; scale?: number[] }
  material_overrides?: { components?: Record<string, Record<string, unknown>> }
  visible?: boolean
  resolvedName?: string
}

/** 标点类型 */
interface MarkerData {
  id: string
  name?: string
  width?: number
  height?: number
  action?: string
  [key: string]: unknown
}

/** 场景编辑页面主组件 */
export function SceneEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const loadingRef = useRef(false)
  const modelLoading = useSceneStore((s) => s.modelLoading)
  const modelLoadingProgress = useSceneStore((s) => s.modelLoadingProgress)
  const getCameraState = useSceneStore((s) => s.getCameraState)
  const setCameraState = useSceneStore((s) => s.setCameraState)
  const editModelObject = useSceneStore((s) => s.modelObject)
  const viewCubeVisible = useSceneStore((s) => s.viewCubeVisible)
  const [sceneName, setSceneName] = useState('')

  // 组件卸载时清理全局 store，防止切到其他场景时残留旧数据
  useEffect(() => {
    return () => {
      useSceneStore.getState().resetScene()
      useEditStore.getState().resetEdit()
    }
  }, [])
  const [sceneConfig, setSceneConfig] = useState<SceneConfig | null>(null)
  const [sceneModels, setSceneModels] = useState<SceneModelEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [availableModels, setAvailableModels] = useState<Record<string, unknown>[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [addingModelId, setAddingModelId] = useState<string | null>(null)
  const [editingMarker, setEditingMarker] = useState<MarkerData | null>(null)
  const [markerConfigOpen, setMarkerConfigOpen] = useState(false)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    if (loadingRef.current) return
    loadingRef.current = true
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

        if (scene.scene_config?.ambientIntensity != null) {
          useEditStore.getState().setAmbientIntensity(scene.scene_config.ambientIntensity)
        }
        if (scene.scene_config?.lightIntensity != null) {
          useEditStore.getState().setLightIntensity(scene.scene_config.lightIntensity)
        }
        if (scene.scene_config?.lightColor) {
          useEditStore.getState().setLightColor(scene.scene_config.lightColor)
        }
        if (scene.scene_config?.autoRotate != null) {
          useEditStore.getState().setAutoRotate(scene.scene_config.autoRotate)
        }
        if (scene.scene_config?.autoRotateAxis) {
          useEditStore.getState().setAutoRotateAxis(scene.scene_config.autoRotateAxis)
        }
        if (scene.scene_config?.autoRotateSpeed != null) {
          useEditStore.getState().setAutoRotateSpeed(scene.scene_config.autoRotateSpeed)
        }
        if (scene.scene_config?.gridVisible != null) {
          useEditStore.getState().setGridVisible(scene.scene_config.gridVisible)
        }

        // 暂存相机配置，等 EditSceneSetup 挂载后恢复
        if (scene.scene_config?.camera) {
          useEditStore.getState().setSavedCameraConfig(scene.scene_config.camera)
        }

        const sceneData = await getSceneData(id)

        // 恢复标点数据
        if (sceneData.markers && Array.isArray(sceneData.markers)) {
          const store = useEditStore.getState()
          store.markers.forEach(() => {})
          sceneData.markers.forEach((m: Record<string, unknown>) => {
            if (!store.markers.find((existing) => existing.id === m.id)) {
              store.addMarker({ ...m, action: m.action || 'none' })
            }
          })
        }

        // 恢复场景图片数据
        if (sceneData.images && Array.isArray(sceneData.images)) {
          useEditStore.getState().setSceneImages(sceneData.images)
        }

        if (sceneData.models && sceneData.models.length > 0) {
          const store = useEditStore.getState()
          store.setModelLoadingProgress(0)
          store.setModelLoading(true)
          useSceneStore.getState().setModelLoading(true)

          // 元数据加载完成，关闭 loading 让主布局渲染，这样才能显示模型加载进度
          setLoading(false)

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
            (loaded, total, name, overallPercent) => {
              const progress = overallPercent ?? Math.round((loaded / total) * 100)
              useEditStore.getState().setModelLoadingProgress(progress)
            },
          )

          store.setModelLoadingProgress(100)
          store.setModelObject(sceneGroup)
          useSceneStore.getState().setModelObject(sceneGroup)

          // 延迟关闭 loading，确保 "渲染中..." 状态可见且 Three.js 完成首帧渲染
          setTimeout(() => {
            useEditStore.getState().setModelLoading(false)
            useSceneStore.getState().setModelLoading(false)
          }, 300)

          // 根据 material_overrides 中 _deleted 标记，移除已删除的构件
          for (const sm of sceneData.models) {
            if (!sm.material_overrides?.components) continue
            for (const [key, value] of Object.entries(sm.material_overrides.components)) {
              if (!(value as Record<string, unknown>)?._deleted) continue
              // 通过 name 匹配找到 Three.js 节点并移除
              const obj = sceneGroup.getObjectByName(key)
              if (obj) obj.removeFromParent()
            }
          }

          // 从加载的模型中恢复 editData（描述 + 材质覆盖）
          const restoredEditData: Record<string, Record<string, unknown>> = {}
          // 收集所有覆盖数据，key → override 值
          const overrideData = new Map<string, Record<string, unknown>>()
          for (const sm of sceneData.models) {
            if (sm.material_overrides?.components) {
              for (const [k, v] of Object.entries(sm.material_overrides.components)) {
                if ((v as Record<string, unknown>)?._deleted) continue
                overrideData.set(k, v)
              }
            }
          }
          console.log('[Restore] overrideData keys:', [...overrideData.keys()])
          sceneGroup.traverse((child) => {
            if (child === sceneGroup) return
            // 跳过 wrapper Group，只处理 GLTF 模型内的节点
            if (child.userData?.sceneModelId) return
            const desc = child.userData?.description
            // 通过 name / path / uuid 匹配查找覆盖数据
            let override: Record<string, unknown> | null = null
            let matchBy = ''
            if (child.name && overrideData.has(child.name)) {
              override = overrideData.get(child.name)
              matchBy = 'name'
            }
            if (!override && child.parent) {
              let modelRoot: THREE.Object3D | null = null
              let p = child.parent
              while (p && p !== sceneGroup) {
                if (p.userData?.sceneModelId && p.children[0]) {
                  modelRoot = p.children[0]
                  break
                }
                p = p.parent
              }
              if (modelRoot) {
                const path = getNodePath(child, modelRoot)
                if (overrideData.has(path)) {
                  override = overrideData.get(path)
                  matchBy = 'path'
                }
              }
            }
            if (!override && overrideData.has(child.uuid)) {
              override = overrideData.get(child.uuid)
              matchBy = 'uuid'
            }
            if (!desc && !override) return
            if (override) {
              console.log('[Restore] matched:', child.name || child.type,
                'by:', matchBy, 'color:', override.color, 'opacity:', override.opacity)
            }
            restoredEditData[child.uuid] = {
              position: child.position.toArray() as [number, number, number],
              rotation: [child.rotation.x, child.rotation.y, child.rotation.z] as [number, number, number],
              scale: child.scale.toArray() as [number, number, number],
              color: override?.color ?? null,
              opacity: override?.opacity ?? null,
              mapUrl: override?.mapUrl ?? null,
              normalMapUrl: override?.normalMapUrl ?? null,
              roughnessMapUrl: override?.roughnessMapUrl ?? null,
              metalnessMapUrl: override?.metalnessMapUrl ?? null,
              emissiveMapUrl: override?.emissiveMapUrl ?? null,
              visible: child.visible,
              name: child.name || null,
              description: desc || override?.description || null,
            }
          })
          console.log('[Restore] total entries:', Object.keys(restoredEditData).length)
          if (Object.keys(restoredEditData).length > 0) {
            store.loadEditData(restoredEditData)

            // 将 editData 中的材质属性应用到 Three.js 材质上
            const texLoader = new THREE.TextureLoader()
            texLoader.setCrossOrigin('anonymous')
            for (const [uuid, data] of Object.entries(restoredEditData)) {
              const obj = sceneGroup.getObjectByProperty('uuid', uuid)
              if (!obj) continue
              obj.traverse((child) => {
                if (!(child as THREE.Mesh).isMesh) return
                const mesh = child as THREE.Mesh
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
                for (const m of materials) {
                  const mat = m as THREE.MeshStandardMaterial
                  if (data.color) {
                    if (!mat.userData._originalColor) mat.userData._originalColor = mat.color.getHexString()
                    mat.color.set(data.color)
                  }
                  if (data.opacity != null) {
                    if (mat.userData._originalOpacity === undefined) mat.userData._originalOpacity = mat.opacity
                    mat.transparent = data.opacity < 1
                    mat.opacity = data.opacity
                  }
                  const texChannels: Array<{
                    url: string | null
                    mapKey: keyof Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap'>
                    origKey: string
                  }> = [
                    { url: data.mapUrl, mapKey: 'map', origKey: '_originalMap' },
                    { url: data.normalMapUrl, mapKey: 'normalMap', origKey: '_originalNormalMap' },
                    { url: data.roughnessMapUrl, mapKey: 'roughnessMap', origKey: '_originalRoughnessMap' },
                    { url: data.metalnessMapUrl, mapKey: 'metalnessMap', origKey: '_originalMetalnessMap' },
                    { url: data.emissiveMapUrl, mapKey: 'emissiveMap', origKey: '_originalEmissiveMap' },
                  ]
                  for (const { url, mapKey, origKey } of texChannels) {
                    if (url) {
                      if (!mat.userData[origKey]) mat.userData[origKey] = mat[mapKey]
                      console.log('[Restore] loading texture:', mapKey, url, 'for obj:', uuid)
                      const tex = texLoader.load(
                        url,
                        () => {
                          mat.needsUpdate = true
                          console.log('[Restore] texture loaded:', mapKey, url)
                        },
                        undefined,
                        (err) => { console.error('[Restore] texture FAILED:', mapKey, url, err) },
                      )
                      if (mapKey === 'map') tex.colorSpace = THREE.SRGBColorSpace
                      mat[mapKey] = tex
                    } else if (url === '') {
                      mat[mapKey] = null
                    }
                  }
                  mat.needsUpdate = true
                }
              })
            }
          }

          const enriched = sceneData.models.map((sm: Record<string, unknown>) => ({
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

  /** 选中/取消选中指定模型（wrapper 级别），再次点击取消选中 */
  const handleFocusModel = useCallback((sceneModelId: string) => {
    const store = useEditStore.getState()
    const root = store.modelObject
    if (!root) return

    const target = root.children.find(
      (child) => child.userData?.sceneModelId === sceneModelId,
    )
    if (target) {
      // 已选中则取消，否则选中
      store.selectComponent(store.selectedComponentId === target.uuid ? null : target.uuid)
    }
  }, [])

  /** 保存场景所有数据（名称、配置、模型变换、材质覆盖等） */
  const handleSaveAll = useCallback(async () => {
    if (!id) return
    setSaving(true)
    try {
      const store = useEditStore.getState()

      // 获取当前相机状态用于保存
      const cameraState = useSceneStore.getState().getCameraState?.()

      await updateScene(id, {
        name: sceneName,
        scene_config: {
          ...sceneConfig,
          camera: cameraState
            ? { position: cameraState.position, target: cameraState.target, fov: cameraState.fov }
            : sceneConfig?.camera,
          background: store.backgroundConfig,
          ambientIntensity: store.ambientIntensity,
          lightIntensity: store.lightIntensity,
          lightColor: store.lightColor,
          autoRotate: store.autoRotate,
          autoRotateAxis: store.autoRotateAxis,
          autoRotateSpeed: store.autoRotateSpeed,
          gridVisible: store.gridVisible,
        },
        markers: store.markers,
      } as Parameters<typeof updateScene>[1] & { markers: typeof store.markers })

      const editData = store.editData
      const root = store.modelObject

      const updates = sceneModels.map((sm) => {
        // 查找该场景模型对应的 wrapper Group
        const wrapper = root?.children.find(
          (child) => child.userData?.sceneModelId === sm.id,
        )

        // 从 live Object3D 读取实际变换（用户可能移动了模型）
        const liveTransform = wrapper
          ? {
              position: wrapper.position.toArray() as [number, number, number],
              rotation: [wrapper.rotation.x, wrapper.rotation.y, wrapper.rotation.z] as [number, number, number],
              scale: wrapper.scale.toArray() as [number, number, number],
            }
          : sm.transform

        // 收集属于该模型的构件编辑数据
        // 以数据库中已有的 material_overrides 为基础，合并当前编辑
        const existingComponents = (sm.material_overrides as { components?: Record<string, Record<string, unknown>> } | undefined)?.components || {}
        const modelEdits: Record<string, Record<string, unknown>> = { ...existingComponents }
        if (wrapper) {
          // GLTF 模型根节点（wrapper 的第一个子节点），用于计算索引路径
          const modelRoot = wrapper.children[0]

          // 先处理标记为已删除的构件（已从场景中移除，但 editData 中有 _deleted 标记）
          for (const [, data] of Object.entries(editData)) {
            if (!data._deleted) continue
            const name = data.name
            if (!name) continue
            // 确认属于当前 wrapper（通过 name 匹配）
            modelEdits[name] = { ...(existingComponents[name] || {}), _deleted: true }
          }

          wrapper.traverse((child) => {
            if (child === wrapper) return
            const data = editData[child.uuid]
            if (!data) return
            // 跳过已删除的构件
            if (data._deleted) return
            // 只要有 editData 就保存，不做绝对值判断（避免默认值被跳过）
            // 用 name 作为 key（跨会话稳定），无 name 时用索引路径
            const key = child.name || (modelRoot ? getNodePath(child, modelRoot) : child.uuid)
            const existing = existingComponents[key] || {}
            modelEdits[key] = {
              ...existing,
              ...(data.color != null && { color: data.color }),
              ...(data.opacity != null && { opacity: data.opacity }),
              ...(data.mapUrl != null && { mapUrl: data.mapUrl }),
              ...(data.normalMapUrl != null && { normalMapUrl: data.normalMapUrl }),
              ...(data.roughnessMapUrl != null && { roughnessMapUrl: data.roughnessMapUrl }),
              ...(data.metalnessMapUrl != null && { metalnessMapUrl: data.metalnessMapUrl }),
              ...(data.emissiveMapUrl != null && { emissiveMapUrl: data.emissiveMapUrl }),
              ...(data.description != null && { description: data.description }),
              position: data.position,
              rotation: data.rotation,
              scale: data.scale,
            }
          })
        }

        return {
          id: sm.id,
          transform: liveTransform,
          material_overrides: Object.keys(modelEdits).length > 0 ? { components: modelEdits } : undefined,
          visible: sm.visible,
        }
      })

      // 诊断日志：追踪保存的变换数据
      for (const u of updates) {
        if (u.transform || u.material_overrides) {
          console.log('[Save] model:', u.id,
            'transform:', JSON.stringify(u.transform),
            'overrides:', u.material_overrides?.components
              ? Object.entries(u.material_overrides.components).map(([k, v]) => `${k}: pos=${(v as Record<string, unknown>).position}`)
              : [])
        }
      }

      await batchUpdateSceneModels(id, updates)

      // 保存场景图片
      await batchSaveSceneImages(id, store.sceneImages)

      // 同步更新 sceneModels 状态，确保后续保存时 existingComponents 反映最新数据
      setSceneModels((prev) =>
        prev.map((sm) => {
          const update = updates.find((u) => u.id === sm.id)
          if (!update) return sm
          return {
            ...sm,
            transform: update.transform ?? sm.transform,
            material_overrides: update.material_overrides ?? sm.material_overrides,
            visible: update.visible ?? sm.visible,
          }
        })
      )
      // 使场景数据缓存失效，确保预览页获取最新数据
      invalidateHttpCache('/scenes/' + id + '/data')
      useEditStore.getState().setIsDirty(false)
      message.success('保存成功')
    } catch (err) {
      message.error('保存失败')
      console.error('[SceneEditor] 保存失败:', err)
    }
    setSaving(false)
  }, [id, sceneName, sceneConfig, sceneModels])

  /** 确认并导航：如果有未保存更改则弹窗确认，预览时在新标签页打开 */
  const confirmAndNavigate = useCallback((target: string, newTab: boolean = false) => {
    const doNavigate = () => {
      if (newTab) {
        window.open(target, '_blank')
      } else {
        navigate(target)
      }
    }
    if (!useEditStore.getState().isDirty) {
      doNavigate()
      return
    }
    Modal.confirm({
      title: '未保存的更改',
      content: '你有未保存的更改，是否保存后再继续？',
      okText: '保存并继续',
      cancelText: '不保存',
      onOk: async () => {
        await handleSaveAll()
        doNavigate()
      },
      onCancel: () => doNavigate(),
    })
  }, [navigate, handleSaveAll])

  /** 预览场景：在新标签页打开预览页面 */
  const handlePreview = useCallback(() => {
    confirmAndNavigate(`/view/${id}?type=scene`, true)
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
      const file = new File([blob], `scene-${id}-thumbnail.png`, { type: 'image/png' })
      const result = await uploadFile(file)
      await updateScene(id, { thumbnail_url: result.url })
      invalidateHttpCache('/scenes')
      message.success('封面已设置')
    } catch (err) {
      console.error('[SceneEditor] 设为封面失败:', err)
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

  // Ctrl+S 快捷保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!saving) handleSaveAll()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveAll, saving])

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
      let sceneModelData: Record<string, unknown>
      try {
        sceneModelData = await addModelToScene(id, { model_id: modelId })
      } catch (e) {
        console.error('[SceneEditor] 步骤1-添加到场景失败:', e)
        throw new Error('添加模型到场景失败(API)，请检查后端服务', { cause: e })
      }

      let modelInfo: Record<string, unknown>
      try {
        modelInfo = await getModel(modelId)
      } catch (e) {
        console.error('[SceneEditor] 步骤2-获取模型信息失败:', e)
        throw new Error('获取模型信息失败，请检查模型是否存在', { cause: e })
      }
      if (!modelInfo?.file_url) {
        throw new Error(`模型 ${modelId} 没有可用的文件 URL`)
      }

      let loadedModel: THREE.Group
      try {
        const result = await loadGLBWithCache(modelInfo.file_url)
        loadedModel = result.scene
      } catch (e) {
        console.error('[SceneEditor] 步骤3-加载GLB模型失败:', e)
        throw new Error(`加载模型文件失败，请检查文件 URL: ${modelInfo.file_url}`, { cause: e })
      }
      const displayName = sceneModelData.display_name || modelInfo.name || `模型 ${modelId.slice(0, 6)}`
      loadedModel.name = displayName

      const wrapper = new THREE.Group()
      wrapper.name = `ModelWrapper_${displayName}`
      wrapper.userData = {
        sceneModelId: sceneModelData.id,
        modelId,
        displayName,
      }

      if (sceneModelData.transform) {
        if (sceneModelData.transform.position) wrapper.position.set(...sceneModelData.transform.position)
        if (sceneModelData.transform.rotation) wrapper.rotation.set(...sceneModelData.transform.rotation)
        if (sceneModelData.transform.scale) wrapper.scale.set(...sceneModelData.transform.scale)
      }

      wrapper.add(loadedModel)

      const store = useEditStore.getState()
      if (store.modelObject) {
        store.modelObject.add(wrapper)
      } else {
        const newGroup = new THREE.Group()
        newGroup.name = 'SceneModels'
        newGroup.add(wrapper)
        store.setModelObject(newGroup)
        useSceneStore.getState().setModelObject(newGroup)
      }
      store.bumpSceneVersion()

      setSceneModels((prev) => [
        ...prev,
        {
          ...sceneModelData,
          model_id: modelId,
          resolvedName: displayName,
        },
      ])

      // 添加模型后自动聚焦到模型（等轴测视角）
      setTimeout(() => {
        const s = useSceneStore.getState()
        if (s.fitToViewFn) s.fitToViewFn({ x: 1, y: 1, z: 1 })
      }, 200)

      message.success('模型已添加')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '添加模型失败'
      console.error('[SceneEditor] 添加模型失败:', err)
      message.error(errorMessage)
    }
    setAddingModelId(null)
  }

  /** 从场景中移除模型 */
  const handleRemoveModel = async (sceneModelId: string) => {
    if (!id) return
    try {
      await removeSceneModel(id, sceneModelId)

      const store = useEditStore.getState()
      if (store.modelObject) {
        const childToRemove = store.modelObject.children.find(
          (child) => child.userData?.sceneModelId === sceneModelId,
        )
        if (childToRemove) {
          store.modelObject.remove(childToRemove)
        }
        store.bumpSceneVersion()
      }

      setSceneModels((prev) => prev.filter((sm) => sm.id !== sceneModelId))
      message.success('模型已移除')
    } catch {
      message.error('移除模型失败')
    }
  }

  if (loading) {
    return (
      <div className="h-full w-full flex justify-center items-center" style={{ background: '#1a1a2e' }}>
        <div className="flex flex-col items-center gap-4">
          <Spin size="large" />
          <span style={{ color: '#aaa', fontSize: 13 }}>加载场景中...</span>
        </div>
      </div>
    )
  }

  return (
    <>
    <Layout className="h-full overflow-hidden">
      <Sider width={300} theme="light" className="border-r border-[--ant-color-border-secondary]" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="py-2 px-4 border-b border-[--ant-color-border-secondary] flex items-center gap-2">
            <Button type="text" size="small" icon={<ArrowLeft20 />} onClick={handleGoBack} />
            <Input
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              size="small"
              variant="borderless"
              style={{ fontWeight: 600, fontSize: 14, flex: 1 }}
            />
            <Button type="text" size="small" icon={<Icon icon={fileCode2Icon} width={14} />} onClick={() => setConfigModalOpen(true)} title="配置管理" />
            <Button type="text" size="small" icon={<Icon icon={cameraIcon} width={14} />} onClick={() => downloadScreenshot()} title="截图" />
            <Button type="text" size="small" icon={<Icon icon={imageIcon} width={14} />} onClick={() => { const dataUrl = captureAsThumbnail(); if (dataUrl) { setCapturedThumbnail(dataUrl); setCropModalOpen(true) } }} title="设为封面" />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <EditPanel
              sceneModels={sceneModels}
              onRemoveModel={handleRemoveModel}
              onOpenAddModal={handleOpenAddModal}
              onAddModel={handleAddModel}
              onSelectModel={handleFocusModel}
              onEditMarker={(m) => { setEditingMarker(m); setMarkerConfigOpen(true); useEditStore.getState().setSelectedMarkerId(m.id) }}
            />
          </div>

          {/* 保存/预览按钮固定在 Sider 底部 */}
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--ant-color-border-secondary)', padding: '8px 12px', display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<Save20 />} onClick={handleSaveAll} loading={saving} style={{ flex: 1 }}>
              保存
            </Button>
            <Button icon={<Eye20 />} onClick={handlePreview} style={{ flex: 1 }}>
              预览
            </Button>
          </div>
        </div>
      </Sider>

      <Content className="relative bg-[#1a1a2e]">
        <EditCanvas />
        {!modelLoading && editModelObject && (
          <>
            <EditToolbar onFitView={handleFitView} />
            {viewCubeVisible && <ViewCube getCameraState={getCameraState} setCameraState={setCameraState} modelObject={editModelObject} />}
          </>
        )}
        <CameraInfo />

        {modelLoading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(26,26,46,0.85)', zIndex: 50 }}>
            <div className="flex flex-col items-center gap-3">
              <Spin size="large" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-white text-xs">
                  {modelLoadingProgress >= 100 ? '渲染中...' : modelLoadingProgress > 0 ? `加载中 ${modelLoadingProgress}%` : '加载中...'}
                </span>
                {modelLoadingProgress > 0 && modelLoadingProgress < 100 ? (
                  <div style={{ width: 160, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${modelLoadingProgress}%`, height: '100%', background: '#4a9eff', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                ) : (
                  <div style={{ width: 160, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', width: '40%', height: '100%', background: '#4a9eff', borderRadius: 2,
                      animation: 'indeterminate 1.5s infinite ease-in-out',
                    }} />
                  </div>
                )}
              </div>
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

    <MarkerConfigPanel
      marker={editingMarker}
      visible={markerConfigOpen}
      onClose={() => { setMarkerConfigOpen(false); setEditingMarker(null) }}
    />

    <ConfigEditModal
      open={configModalOpen}
      sceneName={sceneName}
      sceneModels={sceneModels}
      onClose={() => setConfigModalOpen(false)}
    />

    <ThumbnailCropModal
      open={cropModalOpen}
      imageDataUrl={capturedThumbnail}
      onClose={() => { setCropModalOpen(false); setCapturedThumbnail(null) }}
      onConfirm={async (dataUrl) => {
        setCropModalOpen(false)
        setCapturedThumbnail(null)
        await handleSetThumbnail(dataUrl)
      }}
    />
    </>
  )
}
