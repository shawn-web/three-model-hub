import { describe, it, expect, beforeEach } from 'vitest'
import { useSceneStore } from '../src/store/scene-store'

describe('SceneStore', () => {
  beforeEach(() => {
    useSceneStore.setState({
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
    })
  })

  it('should set model URL', () => {
    useSceneStore.getState().setModelUrl('http://example.com/model.glb')
    expect(useSceneStore.getState().modelUrl).toBe('http://example.com/model.glb')
  })

  it('should set model loading state', () => {
    useSceneStore.getState().setModelLoading(true)
    expect(useSceneStore.getState().modelLoading).toBe(true)
  })

  it('should set model loading progress', () => {
    useSceneStore.getState().setModelLoadingProgress(75)
    expect(useSceneStore.getState().modelLoadingProgress).toBe(75)
  })

  it('should set selected component id', () => {
    useSceneStore.getState().setSelectedComponentId('uuid-123')
    expect(useSceneStore.getState().selectedComponentId).toBe('uuid-123')
  })

  it('should toggle xray mode', () => {
    useSceneStore.getState().setXrayMode(true)
    expect(useSceneStore.getState().xrayMode).toBe(true)
  })

  it('should add and remove markers', () => {
    const marker = { id: 'm1', position: { x: 1, y: 2, z: 3 }, text: '测试' }
    useSceneStore.getState().addMarker(marker as any)
    expect(useSceneStore.getState().markers).toHaveLength(1)

    useSceneStore.getState().removeMarker('m1')
    expect(useSceneStore.getState().markers).toHaveLength(0)
  })

  it('should update marker', () => {
    const marker = { id: 'm1', position: { x: 1, y: 2, z: 3 }, text: '测试' }
    useSceneStore.getState().addMarker(marker as any)
    useSceneStore.getState().updateMarker('m1', { text: '更新后' } as any)
    expect(useSceneStore.getState().markers[0].text).toBe('更新后')
  })

  it('should add and remove scene images', () => {
    const image = { id: 'i1', url: 'http://example.com/img.jpg', position: { x: 0, y: 0, z: 0 } }
    useSceneStore.getState().addSceneImage(image as any)
    expect(useSceneStore.getState().sceneImages).toHaveLength(1)

    useSceneStore.getState().removeSceneImage('i1')
    expect(useSceneStore.getState().sceneImages).toHaveLength(0)
  })

  it('should toggle grid visibility', () => {
    useSceneStore.getState().setGridVisible(true)
    expect(useSceneStore.getState().gridVisible).toBe(true)
  })

  it('should set auto rotate', () => {
    useSceneStore.getState().setAutoRotate(true)
    expect(useSceneStore.getState().autoRotate).toBe(true)
  })

  it('should set auto rotate axis', () => {
    useSceneStore.getState().setAutoRotateAxis('x')
    expect(useSceneStore.getState().autoRotateAxis).toBe('x')
  })

  it('should set auto rotate speed', () => {
    useSceneStore.getState().setAutoRotateSpeed(5)
    expect(useSceneStore.getState().autoRotateSpeed).toBe(5)
  })

  it('should toggle camera info visibility', () => {
    useSceneStore.getState().setCameraInfoVisible(true)
    expect(useSceneStore.getState().cameraInfoVisible).toBe(true)
  })

  it('should toggle view cube visibility', () => {
    useSceneStore.getState().setViewCubeVisible(false)
    expect(useSceneStore.getState().viewCubeVisible).toBe(false)
  })

  it('should reset scene to initial state', () => {
    useSceneStore.getState().setModelUrl('http://example.com/model.glb')
    useSceneStore.getState().setXrayMode(true)
    useSceneStore.getState().setSelectedComponentId('uuid-123')
    useSceneStore.getState().resetScene()

    const state = useSceneStore.getState()
    expect(state.modelUrl).toBeNull()
    expect(state.xrayMode).toBe(false)
    expect(state.selectedComponentId).toBeNull()
    expect(state.markers).toEqual([])
    expect(state.sceneImages).toEqual([])
  })
})
