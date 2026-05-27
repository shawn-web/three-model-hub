import { create } from 'zustand'
import type * as THREE from 'three'
import type { MarkerData, SceneMedia } from '../types/edit-data'
import type { SelectionHighlightManager } from '../utils/selection-highlight'

export interface CameraStateData {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  up: { x: number; y: number; z: number }
  fov: number
}

export interface CameraStateInput {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  up?: { x: number; y: number; z: number }
  fov?: number
}

export interface SceneState {
  modelUrl: string | null
  modelObject: THREE.Group | null
  modelLoading: boolean
  modelLoadingProgress: number
  selectedComponentId: string | null
  xrayMode: boolean
  markers: MarkerData[]
  sceneImages: SceneMedia[]
  gridVisible: boolean
  autoRotate: boolean
  autoRotateAxis: 'x' | 'y' | 'z'
  autoRotateSpeed: number
  cameraInfoVisible: boolean
  viewCubeVisible: boolean
  getCameraState: (() => CameraStateData) | null
  setCameraState: ((state: CameraStateInput) => void) | null
  fitToViewFn: ((direction?: { x: number; y: number; z: number }) => void) | null
  highlightManager: SelectionHighlightManager | null
}

export interface SceneActions {
  setModelUrl: (url: string | null) => void
  setModelObject: (obj: THREE.Group | null) => void
  setModelLoading: (loading: boolean) => void
  setModelLoadingProgress: (percent: number) => void
  setSelectedComponentId: (id: string | null) => void
  selectComponent: (id: string | null) => void
  setXrayMode: (enabled: boolean) => void
  setMarkers: (markers: MarkerData[]) => void
  addMarker: (marker: MarkerData) => void
  removeMarker: (id: string) => void
  updateMarker: (id: string, updates: Partial<MarkerData>) => void
  setSceneImages: (images: SceneMedia[]) => void
  addSceneImage: (image: SceneMedia) => void
  removeSceneImage: (id: string) => void
  updateSceneImage: (id: string, updates: Partial<SceneMedia>) => void
  setGridVisible: (visible: boolean) => void
  setAutoRotate: (value: boolean) => void
  setAutoRotateAxis: (axis: 'x' | 'y' | 'z') => void
  setAutoRotateSpeed: (speed: number) => void
  setCameraInfoVisible: (visible: boolean) => void
  setViewCubeVisible: (visible: boolean) => void
  setGetCameraState: (fn: SceneState['getCameraState']) => void
  setSetCameraState: (fn: SceneState['setCameraState']) => void
  setFitToViewFn: (fn: ((direction?: { x: number; y: number; z: number }) => void) | null) => void
  setHighlightManager: (mgr: SelectionHighlightManager | null) => void
  resetScene: () => void
}

const initialState: SceneState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  modelLoadingProgress: 0,
  selectedComponentId: null,
  xrayMode: false,
  markers: [],
  sceneImages: [],
  gridVisible: false,
  autoRotate: false,
  autoRotateAxis: 'y',
  autoRotateSpeed: 2,
  cameraInfoVisible: false,
  viewCubeVisible: true,
  getCameraState: null,
  setCameraState: null,
  fitToViewFn: null,
  highlightManager: null,
}

export const useSceneStore = create<SceneState & SceneActions>()((set) => ({
  ...initialState,

  setModelUrl: (url) => set({ modelUrl: url }),
  setModelObject: (obj) => set({ modelObject: obj }),
  setModelLoading: (loading) => set({ modelLoading: loading, modelLoadingProgress: loading ? 0 : 0 }),
  setModelLoadingProgress: (percent) => set({ modelLoadingProgress: percent }),
  setSelectedComponentId: (id) => set({ selectedComponentId: id }),
  selectComponent: (id) => set({ selectedComponentId: id }),
  setXrayMode: (enabled) => set({ xrayMode: enabled }),

  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => set((state) => ({ markers: [...state.markers, marker] })),
  removeMarker: (id) => set((state) => ({ markers: state.markers.filter((m) => m.id !== id) })),
  updateMarker: (id, updates) => set((state) => ({
    markers: state.markers.map((m) => m.id === id ? { ...m, ...updates } : m),
  })),

  setSceneImages: (images) => set({ sceneImages: images }),
  addSceneImage: (image) => set((state) => ({ sceneImages: [...state.sceneImages, image] })),
  removeSceneImage: (id) => set((state) => ({ sceneImages: state.sceneImages.filter((i) => i.id !== id) })),
  updateSceneImage: (id, updates) => set((state) => ({
    sceneImages: state.sceneImages.map((i) => i.id === id ? { ...i, ...updates } : i),
  })),

  setGridVisible: (visible) => set({ gridVisible: visible }),
  setAutoRotate: (value) => set({ autoRotate: value }),
  setAutoRotateAxis: (axis) => set({ autoRotateAxis: axis }),
  setAutoRotateSpeed: (speed) => set({ autoRotateSpeed: speed }),
  setCameraInfoVisible: (visible) => set({ cameraInfoVisible: visible }),
  setViewCubeVisible: (visible) => set({ viewCubeVisible: visible }),

  setGetCameraState: (fn) => set({ getCameraState: fn }),
  setSetCameraState: (fn) => set({ setCameraState: fn }),
  setFitToViewFn: (fn) => set({ fitToViewFn: fn }),
  setHighlightManager: (mgr) => set({ highlightManager: mgr }),

  resetScene: () => set(initialState),
}))

export type SceneStoreApi = typeof useSceneStore
