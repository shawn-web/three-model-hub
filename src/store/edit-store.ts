import { create } from 'zustand'
import type * as THREE from 'three'

export type TransformMode = 'translate' | 'rotate' | 'scale'

export interface EditComponentData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string | null
  opacity: number | null
  visible: boolean
}

export interface EditState {
  modelUrl: string | null
  modelObject: THREE.Group | null
  modelLoading: boolean
  selectedComponentId: string | null
  transformMode: TransformMode
  editData: Record<string, EditComponentData>
}

export interface EditActions {
  setModelUrl: (url: string | null) => void
  setModelObject: (obj: THREE.Group | null) => void
  setModelLoading: (loading: boolean) => void
  selectComponent: (id: string | null) => void
  setTransformMode: (mode: TransformMode) => void
  updateComponentTransform: (uuid: string, transform: Partial<{ position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }>) => void
  updateComponentMaterial: (uuid: string, material: { color?: string | null; opacity?: number | null }) => void
  updateComponentVisibility: (uuid: string, visible: boolean) => void
  loadEditData: (data: Record<string, EditComponentData>) => void
  resetEdit: () => void
}

const initialState: EditState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  selectedComponentId: null,
  transformMode: 'translate',
  editData: {},
}

export const useEditStore = create<EditState & EditActions>()((set) => ({
  ...initialState,

  setModelUrl: (url) => set({ modelUrl: url }),
  setModelObject: (obj) => set({ modelObject: obj }),
  setModelLoading: (loading) => set({ modelLoading: loading }),
  selectComponent: (id) => set({ selectedComponentId: id }),
  setTransformMode: (mode) => set({ transformMode: mode }),

  updateComponentTransform: (uuid, transform) => set((state) => {
    const existing = state.editData[uuid] || {
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      color: null,
      opacity: null,
      visible: true,
    }
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
    }
  }),

  updateComponentMaterial: (uuid, material) => set((state) => {
    const existing = state.editData[uuid] || {
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      color: null,
      opacity: null,
      visible: true,
    }
    return {
      editData: {
        ...state.editData,
        [uuid]: {
          ...existing,
          color: material.color !== undefined ? material.color : existing.color,
          opacity: material.opacity !== undefined ? material.opacity : existing.opacity,
        },
      },
    }
  }),

  updateComponentVisibility: (uuid, visible) => set((state) => {
    const existing = state.editData[uuid] || {
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      color: null,
      opacity: null,
      visible: true,
    }
    return {
      editData: {
        ...state.editData,
        [uuid]: { ...existing, visible },
      },
    }
  }),

  loadEditData: (data) => set({ editData: data }),
  resetEdit: () => set(initialState),
}))

export type EditStoreApi = typeof useEditStore
