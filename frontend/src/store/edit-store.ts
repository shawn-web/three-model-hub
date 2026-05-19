import { create } from 'zustand'
import { temporal } from 'zundo'
import type * as THREE from 'three'
import type { MarkerData } from '../types/edit-data'

/** 场景背景配置 */
export type BackgroundConfig =
  | { type: 'color'; color: string }
  | { type: 'image'; url: string }
  | { type: 'skybox'; urls: [string, string, string, string, string, string] }
  | { type: 'hdr'; url: string }

export type TransformMode = 'translate' | 'rotate' | 'scale'

export interface EditComponentData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string | null
  opacity: number | null
  visible: boolean
  name: string | null
  description: string | null
}

export interface EditState {
  modelUrl: string | null
  modelObject: THREE.Group | null
  modelLoading: boolean
  /** 是否有未保存的编辑 */
  isDirty: boolean
  /** 当前选中的构件 UUID */
  selectedComponentId: string | null
  transformMode: TransformMode
  editData: Record<string, EditComponentData>
  autoRotate: boolean
  backgroundColor: string
  /** 场景背景配置 */
  backgroundConfig: BackgroundConfig | null
  markers: MarkerData[]
  addingMarker: boolean
  fitToViewFn: (() => void) | null
}

export interface EditActions {
  setModelUrl: (url: string | null) => void
  setModelObject: (obj: THREE.Group | null) => void
  setModelLoading: (loading: boolean) => void
  setIsDirty: (dirty: boolean) => void
  selectComponent: (id: string | null) => void
  setSelectedComponentId: (id: string | null) => void
  setTransformMode: (mode: TransformMode) => void
  updateComponentTransform: (uuid: string, transform: Partial<{ position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }>) => void
  updateComponentMaterial: (uuid: string, material: { color?: string | null; opacity?: number | null }) => void
  updateComponentVisibility: (uuid: string, visible: boolean) => void
  updateComponentName: (uuid: string, name: string | null) => void
  updateComponentDescription: (uuid: string, description: string | null) => void
  loadEditData: (data: Record<string, EditComponentData>) => void
  setAutoRotate: (value: boolean) => void
  setBackgroundColor: (color: string) => void
  setBackgroundConfig: (config: BackgroundConfig | null) => void
  addMarker: (marker: MarkerData) => void
  removeMarker: (id: string) => void
  updateMarker: (id: string, updates: Partial<MarkerData>) => void
  setAddingMarker: (value: boolean) => void
  setFitToViewFn: (fn: (() => void) | null) => void
  resetEdit: () => void
}

const defaultComponent = (): EditComponentData => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: null,
  opacity: null,
  visible: true,
  name: null,
  description: null,
})

const initialState: EditState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  isDirty: false,
  selectedComponentId: null,
  transformMode: 'translate',
  editData: {},
  autoRotate: false,
  backgroundColor: '#1a1a2e',
  backgroundConfig: null,
  markers: [],
  addingMarker: false,
  fitToViewFn: null,
}

export const useEditStore = create<EditState & EditActions>()(
  temporal(
    (set) => ({
      ...initialState,

      setModelUrl: (url) => set({ modelUrl: url }),
      setModelObject: (obj) => set({ modelObject: obj }),
      setModelLoading: (loading) => set({ modelLoading: loading }),
      setIsDirty: (dirty) => set({ isDirty: dirty }),
      selectComponent: (id) => set({ selectedComponentId: id }),
      setSelectedComponentId: (id) => set({ selectedComponentId: id }),
      setTransformMode: (mode) => set({ transformMode: mode }),

      updateComponentTransform: (uuid, transform) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: {
              ...existing,
              ...transform,
              position: transform.position ?? existing.position,
              rotation: transform.rotation ?? existing.rotation,
              scale: transform.scale ?? existing.scale,
            },
          },
          isDirty: true,
        }
      }),

      updateComponentMaterial: (uuid, material) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: {
              ...existing,
              color: material.color !== undefined ? material.color : existing.color,
              opacity: material.opacity !== undefined ? material.opacity : existing.opacity,
            },
          },
          isDirty: true,
        }
      }),

      updateComponentVisibility: (uuid, visible) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: { ...existing, visible },
          },
          isDirty: true,
        }
      }),

      updateComponentName: (uuid, name) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: { ...existing, name },
          },
        }
      }),

      updateComponentDescription: (uuid, description) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: { ...existing, description },
          },
        }
      }),

      loadEditData: (data) => set({ editData: data }),
      setAutoRotate: (value) => set({ autoRotate: value }),
      setBackgroundColor: (color) => set({ backgroundColor: color }),
      setBackgroundConfig: (config) => {
        set({ backgroundConfig: config, isDirty: true })
      },

      addMarker: (marker) => set((state) => ({ markers: [...state.markers, marker] })),
      removeMarker: (id) => set((state) => ({ markers: state.markers.filter((m) => m.id !== id) })),
      updateMarker: (id, updates) => set((state) => ({
        markers: state.markers.map((m) => m.id === id ? { ...m, ...updates } : m),
      })),
      setAddingMarker: (value) => set({ addingMarker: value }),
      setFitToViewFn: (fn) => set({ fitToViewFn: fn }),
      resetEdit: () => set(initialState),
    }),
    {
      limit: 50,
      equality: (pastState, currentState) =>
        JSON.stringify(pastState.editData) === JSON.stringify(currentState.editData)
        && pastState.autoRotate === currentState.autoRotate
        && pastState.backgroundColor === currentState.backgroundColor
        && JSON.stringify(pastState.markers) === JSON.stringify(currentState.markers),
    }
  )
)

export const useTemporalStore = useEditStore.temporal

export type EditStoreApi = typeof useEditStore
