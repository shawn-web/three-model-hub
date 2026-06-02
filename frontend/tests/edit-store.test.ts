import { describe, it, expect, beforeEach } from 'vitest'
import { useEditStore, useTemporalStore } from '../src/store/edit-store'

describe('EditStore', () => {
  beforeEach(() => {
    useEditStore.setState({
      modelUrl: null,
      modelObject: null,
      modelLoading: false,
      modelLoadingProgress: 0,
      isDirty: false,
      selectedComponentId: null,
      transformMode: null,
      editData: {},
      autoRotate: false,
      autoRotateAxis: 'y',
      autoRotateSpeed: 2,
      backgroundColor: '#1a1a2e',
      backgroundConfig: null,
      ambientIntensity: 0.8,
      lightIntensity: 1.0,
      lightColor: '#ffffff',
      markers: [],
      addingMarker: false,
      editingMarkerId: null,
      selectedMarkerId: null,
      sceneImages: [],
      selectedImageId: null,
      placingImageId: null,
      gridVisible: false,
      activeTab: 'scene',
      cameraInfoVisible: false,
      fitToViewFn: null,
      getCameraState: null,
      setCameraState: null,
      savedCameraConfig: null,
      sceneVersion: 0,
      xrayMode: false,
      highlightManager: null,
      invalidateFn: null,
      skipSelectionAnim: false,
    })
    // 清除时间旅行历史
    useTemporalStore.getState().clear()
  })

  it('should set model URL', () => {
    useEditStore.getState().setModelUrl('http://example.com/model.glb')
    expect(useEditStore.getState().modelUrl).toBe('http://example.com/model.glb')
  })

  it('should set dirty flag on edit operations', () => {
    useEditStore.getState().updateComponentTransform('uuid-1', { position: [1, 2, 3] })
    expect(useEditStore.getState().isDirty).toBe(true)
  })

  it('should update component transform', () => {
    useEditStore.getState().updateComponentTransform('uuid-1', {
      position: [1, 2, 3],
      rotation: [0, 90, 0],
    })
    const data = useEditStore.getState().editData['uuid-1']
    expect(data.position).toEqual([1, 2, 3])
    expect(data.rotation).toEqual([0, 90, 0])
    expect(data.scale).toEqual([1, 1, 1])
  })

  it('should update component material', () => {
    useEditStore.getState().updateComponentMaterial('uuid-1', {
      color: '#ff0000',
      opacity: 0.5,
    })
    const data = useEditStore.getState().editData['uuid-1']
    expect(data.color).toBe('#ff0000')
    expect(data.opacity).toBe(0.5)
  })

  it('should update component visibility', () => {
    useEditStore.getState().updateComponentVisibility('uuid-1', false)
    expect(useEditStore.getState().editData['uuid-1'].visible).toBe(false)
  })

  it('should delete component', () => {
    useEditStore.getState().deleteComponent('uuid-1', '构件A')
    const data = useEditStore.getState().editData['uuid-1']
    expect(data._deleted).toBe(true)
    expect(data.name).toBe('构件A')
  })

  it('should load edit data', () => {
    const data = {
      'uuid-1': {
        position: [1, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        color: null,
        opacity: null,
        visible: true,
        name: null,
        description: null,
        mapUrl: null,
        normalMapUrl: null,
        roughnessMapUrl: null,
        metalnessMapUrl: null,
        emissiveMapUrl: null,
      },
    }
    useEditStore.getState().loadEditData(data)
    expect(useEditStore.getState().editData).toEqual(data)
  })

  it('should set transform mode', () => {
    useEditStore.getState().setTransformMode('translate')
    expect(useEditStore.getState().transformMode).toBe('translate')
  })

  it('should set background config', () => {
    useEditStore.getState().setBackgroundConfig({ type: 'color', color: '#000000' })
    expect(useEditStore.getState().backgroundConfig).toEqual({ type: 'color', color: '#000000' })
    expect(useEditStore.getState().isDirty).toBe(true)
  })

  it('should manage markers', () => {
    const marker = { id: 'm1', position: { x: 1, y: 2, z: 3 }, text: '批注' }
    useEditStore.getState().addMarker(marker as any)
    expect(useEditStore.getState().markers).toHaveLength(1)

    useEditStore.getState().updateMarker('m1', { text: '更新' } as any)
    expect(useEditStore.getState().markers[0].text).toBe('更新')

    useEditStore.getState().removeMarker('m1')
    expect(useEditStore.getState().markers).toHaveLength(0)
  })

  it('should manage scene images', () => {
    const image = { id: 'i1', url: 'http://example.com/img.jpg' }
    useEditStore.getState().addSceneImage(image as any)
    expect(useEditStore.getState().sceneImages).toHaveLength(1)

    useEditStore.getState().removeSceneImage('i1')
    expect(useEditStore.getState().sceneImages).toHaveLength(0)
  })

  it('should bump scene version', () => {
    useEditStore.getState().bumpSceneVersion()
    expect(useEditStore.getState().sceneVersion).toBe(1)
  })

  it('should reset edit state', () => {
    useEditStore.getState().setModelUrl('http://example.com/model.glb')
    useEditStore.getState().updateComponentTransform('uuid-1', { position: [1, 2, 3] })
    useEditStore.getState().setTransformMode('rotate')
    useEditStore.getState().resetEdit()

    const state = useEditStore.getState()
    expect(state.modelUrl).toBeNull()
    expect(state.editData).toEqual({})
    expect(state.transformMode).toBeNull()
    expect(state.isDirty).toBe(false)
  })
})
