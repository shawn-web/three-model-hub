import { describe, it, expect, beforeEach } from 'vitest'
import { useViewerStore } from '../src/store/viewer-store'

describe('ViewerStore', () => {
  beforeEach(() => {
    useViewerStore.setState({
      modelUrl: null,
      modelObject: null,
      modelLoading: false,
      activePluginId: null,
      visibleTools: [],
      hiddenTools: [],
      environmentPreset: 'city',
      toolbarVisible: true,
    })
  })

  it('should set model URL', () => {
    useViewerStore.getState().setModelUrl('http://example.com/model.glb')
    expect(useViewerStore.getState().modelUrl).toBe('http://example.com/model.glb')
  })

  it('should set model loading state', () => {
    useViewerStore.getState().setModelLoading(true)
    expect(useViewerStore.getState().modelLoading).toBe(true)
  })

  it('should activate a plugin', () => {
    useViewerStore.getState().setActivePluginId('measurement')
    expect(useViewerStore.getState().activePluginId).toBe('measurement')
  })

  it('should deactivate plugin when set to null', () => {
    useViewerStore.getState().setActivePluginId('measurement')
    useViewerStore.getState().setActivePluginId(null)
    expect(useViewerStore.getState().activePluginId).toBe(null)
  })

  it('should configure visible tools', () => {
    useViewerStore.getState().setVisibleTools(['navigation', 'picking'])
    expect(useViewerStore.getState().visibleTools).toEqual(['navigation', 'picking'])
  })

  it('should configure hidden tools', () => {
    useViewerStore.getState().setHiddenTools(['measurement'])
    expect(useViewerStore.getState().hiddenTools).toEqual(['measurement'])
  })

  it('should toggle toolbar visibility', () => {
    useViewerStore.getState().setToolbarVisible(false)
    expect(useViewerStore.getState().toolbarVisible).toBe(false)
  })

  it('should set environment preset', () => {
    useViewerStore.getState().setEnvironmentPreset('sunset')
    expect(useViewerStore.getState().environmentPreset).toBe('sunset')
  })

  it('should reset viewer state', () => {
    useViewerStore.getState().setModelUrl('http://example.com/model.glb')
    useViewerStore.getState().setActivePluginId('picking')
    useViewerStore.getState().resetViewer()
    expect(useViewerStore.getState().modelUrl).toBe(null)
    expect(useViewerStore.getState().activePluginId).toBe(null)
  })
})
