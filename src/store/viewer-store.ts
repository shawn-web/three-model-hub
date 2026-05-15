import { create } from 'zustand'
import type * as THREE from 'three'

export interface ViewerState {
  modelUrl: string | null
  modelObject: THREE.Group | null
  modelLoading: boolean
  modelError: string | null
  activePluginId: string | null
  installedPlugins: string[]
  visibleTools: string[]
  hiddenTools: string[]
  environmentPreset: string
  toolbarVisible: boolean
}

export interface ViewerActions {
  setModelUrl: (url: string | null) => void
  setModelObject: (obj: THREE.Group | null) => void
  setModelLoading: (loading: boolean) => void
  setModelError: (error: string | null) => void
  setActivePluginId: (id: string | null) => void
  setInstalledPlugins: (ids: string[]) => void
  setVisibleTools: (tools: string[]) => void
  setHiddenTools: (tools: string[]) => void
  setEnvironmentPreset: (preset: string) => void
  setToolbarVisible: (visible: boolean) => void
  resetViewer: () => void
}

const initialState: ViewerState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  modelError: null,
  activePluginId: null,
  installedPlugins: [],
  visibleTools: [],
  hiddenTools: [],
  environmentPreset: 'day',
  toolbarVisible: true,
}

export const useViewerStore = create<ViewerState & ViewerActions>()((set) => ({
  ...initialState,

  setModelUrl: (url) => set({ modelUrl: url }),
  setModelObject: (obj) => set({ modelObject: obj }),
  setModelLoading: (loading) => set({ modelLoading: loading }),
  setModelError: (error) => set({ modelError: error }),
  setActivePluginId: (id) => set({ activePluginId: id }),
  setInstalledPlugins: (ids) => set({ installedPlugins: ids }),
  setVisibleTools: (tools) => set({ visibleTools: tools }),
  setHiddenTools: (tools) => set({ hiddenTools: tools }),
  setEnvironmentPreset: (preset) => set({ environmentPreset: preset }),
  setToolbarVisible: (visible) => set({ toolbarVisible: visible }),
  resetViewer: () => set(initialState),
}))

export type ViewerStoreApi = typeof useViewerStore
