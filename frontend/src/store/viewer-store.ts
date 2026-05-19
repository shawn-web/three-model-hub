import { create } from 'zustand'
import type * as THREE from 'three'
import type { ViewpointData } from '../api/viewpoints'
import * as viewpointsApi from '../api/viewpoints'
import type { AnnotationData } from '../api/annotations'
import * as annotationsApi from '../api/annotations'

/** 显示模式类型定义 */
export type DisplayMode = 'shaded' | 'wireframe' | 'transparent'

export interface ViewerState {
  modelUrl: string | null
  modelObject: THREE.Group | null
  modelLoading: boolean
  modelLoadingProgress: number
  modelError: string | null
  activePluginId: string | null
  installedPlugins: string[]
  visibleTools: string[]
  hiddenTools: string[]
  environmentPreset: string
  toolbarVisible: boolean
  treeVisible: boolean
  cameraInfoVisible: boolean
  rotationMode: boolean
  /** 当前显示模式：正常着色 / 线框 / 半透明 */
  displayMode: DisplayMode
  /** 当前场景 ID（用于视点保存等） */
  sceneId: string | null
  /** 当前查看模式：scene（场景）或 model（单个模型） */
  viewerType: 'scene' | 'model' | null
  /** 场景配置（包含背景设置等） */
  sceneConfig: Record<string, any> | null
  /** 已保存的视点列表 */
  viewpoints: ViewpointData[]
  /** 视点加载状态 */
  viewpointsLoading: boolean
  /** 已加载的批注列表 */
  annotations: AnnotationData[]
  /** 是否正在添加批注模式 */
  addingAnnotation: boolean
  /** 点击模型添加批注时的回调（由外部 Toolbar 注册） */
  onAnnotationClick: ((position: { x: number; y: number; z: number }) => void) | null
  /** 用于获取相机状态的外部回调 */
  getCameraState: (() => {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    up: { x: number; y: number; z: number }
    fov: number
  }) | null
  /** 用于设置相机状态的外部回调 */
  setCameraState: ((state: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    up?: { x: number; y: number; z: number }
    fov?: number
  }) => void) | null
}

export interface ViewerActions {
  setModelUrl: (url: string | null) => void
  setModelObject: (obj: THREE.Group | null) => void
  setModelLoading: (loading: boolean) => void
  setModelLoadingProgress: (percent: number) => void
  setModelError: (error: string | null) => void
  setActivePluginId: (id: string | null) => void
  setInstalledPlugins: (ids: string[]) => void
  setVisibleTools: (tools: string[]) => void
  setHiddenTools: (tools: string[]) => void
  setEnvironmentPreset: (preset: string) => void
  setToolbarVisible: (visible: boolean) => void
  setTreeVisible: (visible: boolean) => void
  setCameraInfoVisible: (visible: boolean) => void
  setRotationMode: (enabled: boolean) => void
  /** 设置显示模式 */
  setDisplayMode: (mode: DisplayMode) => void
  resetViewer: () => void
  /** 设置当前场景 ID */
  setSceneId: (sceneId: string | null) => void
  setViewerType: (type: 'scene' | 'model' | null) => void
  /** 设置场景配置 */
  setSceneConfig: (config: Record<string, any> | null) => void
  /** 注册获取相机状态的回调 */
  setGetCameraState: (fn: ViewerState['getCameraState']) => void
  /** 注册设置相机状态的回调 */
  setSetCameraState: (fn: ViewerState['setCameraState']) => void
  /** 加载指定场景的视点列表 */
  loadViewpoints: (sceneId: string) => Promise<void>
  /** 保存当前视角为新视点 */
  saveViewpoint: (sceneId: string, name: string) => Promise<ViewpointData>
  /** 删除指定视点 */
  deleteViewpoint: (sceneId: string, id: string) => Promise<void>
  /** 应用视点到相机 */
  applyViewpoint: (viewpoint: ViewpointData) => void
  /** 加载指定场景的批注列表 */
  loadAnnotations: (sceneId: string) => Promise<void>
  /** 设置是否处于添加批注模式 */
  setAddingAnnotation: (adding: boolean) => void
  /** 注册批注点击回调 */
  setOnAnnotationClick: (fn: ((position: { x: number; y: number; z: number }) => void) | null) => void
  /** 添加批注 */
  addAnnotation: (sceneId: string, data: { position: { x: number; y: number; z: number }; text: string; author?: string }) => Promise<AnnotationData>
  /** 删除批注 */
  removeAnnotation: (sceneId: string, id: string) => Promise<void>
}

const initialState: ViewerState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  modelLoadingProgress: 0,
  modelError: null,
  activePluginId: null,
  installedPlugins: [],
  visibleTools: [],
  hiddenTools: [],
  environmentPreset: 'none',
  toolbarVisible: true,
  treeVisible: true,
  cameraInfoVisible: false,
  rotationMode: false,
  displayMode: 'shaded',
  sceneId: null,
  viewerType: null,
  sceneConfig: null,
  viewpoints: [],
  viewpointsLoading: false,
  annotations: [],
  addingAnnotation: false,
  onAnnotationClick: null,
  getCameraState: null,
  setCameraState: null,
}

export const useViewerStore = create<ViewerState & ViewerActions>()((set, get) => ({
  ...initialState,

  setModelUrl: (url) => set({ modelUrl: url }),
  setModelObject: (obj) => set({ modelObject: obj }),
  setModelLoading: (loading) => set({ modelLoading: loading, modelLoadingProgress: loading ? 0 : 0 }),
  setModelLoadingProgress: (percent) => set({ modelLoadingProgress: percent }),
  setModelError: (error) => set({ modelError: error }),
  setActivePluginId: (id) => set({ activePluginId: id }),
  setInstalledPlugins: (ids) => set({ installedPlugins: ids }),
  setVisibleTools: (tools) => set({ visibleTools: tools }),
  setHiddenTools: (tools) => set({ hiddenTools: tools }),
  setEnvironmentPreset: (preset) => set({ environmentPreset: preset }),
  setToolbarVisible: (visible) => set({ toolbarVisible: visible }),
  setTreeVisible: (visible) => set({ treeVisible: visible }),
  setCameraInfoVisible: (visible) => set({ cameraInfoVisible: visible }),
  setRotationMode: (enabled) => set({ rotationMode: enabled }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  resetViewer: () => set(initialState),

  setSceneId: (sceneId) => set({ sceneId }),
  setViewerType: (type) => set({ viewerType: type }),
  setSceneConfig: (config) => set({ sceneConfig: config }),

  setGetCameraState: (fn) => set({ getCameraState: fn }),
  setSetCameraState: (fn) => set({ setCameraState: fn }),

  /** 加载指定场景的视点列表 */
  loadViewpoints: async (sceneId: string) => {
    set({ viewpointsLoading: true })
    try {
      const viewpoints = await viewpointsApi.getViewpoints(sceneId)
      set({ viewpoints, viewpointsLoading: false })
    } catch (err) {
      console.error('[ViewerStore] 加载视点失败:', err)
      set({ viewpointsLoading: false })
    }
  },

  /** 保存当前相机状态为新视点 */
  saveViewpoint: async (sceneId: string, name: string) => {
    const { getCameraState } = get()
    if (!getCameraState) {
      throw new Error('相机状态回调未注册')
    }
    const cam = getCameraState()
    const viewpoint = await viewpointsApi.createViewpoint(sceneId, {
      name,
      camera_position: cam.position,
      camera_target: cam.target,
      camera_up: cam.up,
      fov: cam.fov,
    })
    // 刷新视点列表
    const viewpoints = await viewpointsApi.getViewpoints(sceneId)
    set({ viewpoints })
    return viewpoint
  },

  /** 删除指定视点 */
  deleteViewpoint: async (sceneId: string, id: string) => {
    await viewpointsApi.deleteViewpoint(sceneId, id)
    set((state) => ({
      viewpoints: state.viewpoints.filter((v) => v.id !== id),
    }))
  },

  /** 应用视点到相机 */
  applyViewpoint: (viewpoint: ViewpointData) => {
    const { setCameraState } = get()
    if (!setCameraState) {
      console.error('[ViewerStore] 相机设置回调未注册')
      return
    }
    setCameraState({
      position: viewpoint.camera_position,
      target: viewpoint.camera_target,
      up: viewpoint.camera_up ?? undefined,
      fov: viewpoint.fov ?? undefined,
    })
  },

  /** 加载指定场景的批注列表 */
  loadAnnotations: async (sceneId: string) => {
    try {
      const annotations = await annotationsApi.getAnnotations(sceneId)
      set({ annotations })
    } catch (err) {
      console.error('[ViewerStore] 加载批注失败:', err)
    }
  },

  /** 设置是否处于添加批注模式 */
  setAddingAnnotation: (adding: boolean) => {
    set({ addingAnnotation: adding })
  },

  /** 注册批注点击回调 */
  setOnAnnotationClick: (fn: ((position: { x: number; y: number; z: number }) => void) | null) => {
    set({ onAnnotationClick: fn })
  },

  /** 添加批注 */
  addAnnotation: async (sceneId: string, data: { position: { x: number; y: number; z: number }; text: string; author?: string }) => {
    const annotation = await annotationsApi.createAnnotation(sceneId, data)
    // 刷新批注列表
    const annotations = await annotationsApi.getAnnotations(sceneId)
    set({ annotations })
    return annotation
  },

  /** 删除批注 */
  removeAnnotation: async (sceneId: string, id: string) => {
    await annotationsApi.deleteAnnotation(sceneId, id)
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    }))
  },
}))

export type ViewerStoreApi = typeof useViewerStore
