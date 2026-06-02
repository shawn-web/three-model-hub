import { describe, it, expect } from 'vitest'
import {
  MESSAGE_TYPES,
  type LoadModelPayload,
  type SetEnvironmentPayload,
  type ToolConfigPayload,
  type SetCameraPayload,
  type SetSectionPayload,
  type ModelLoadedPayload,
  type ModelErrorPayload,
  type ProgressPayload,
  type MediaClickedPayload,
  type MarkerClickedPayload,
} from '../src/communication/protocol'

describe('Protocol Types', () => {
  it('should have all message type constants', () => {
    expect(MESSAGE_TYPES.LOAD_MODEL).toBe('load-model')
    expect(MESSAGE_TYPES.UNLOAD_MODEL).toBe('unload-model')
    expect(MESSAGE_TYPES.SET_ENVIRONMENT).toBe('set-environment')
    expect(MESSAGE_TYPES.TOOL_CONFIG).toBe('tool-config')
    expect(MESSAGE_TYPES.TOOL_ACTIVATE).toBe('tool-activate')
    expect(MESSAGE_TYPES.SET_CAMERA).toBe('set-camera')
    expect(MESSAGE_TYPES.SET_SECTION).toBe('set-section')
    expect(MESSAGE_TYPES.VIEWER_READY).toBe('viewer-ready')
    expect(MESSAGE_TYPES.MODEL_LOADED).toBe('model-loaded')
    expect(MESSAGE_TYPES.MODEL_ERROR).toBe('model-error')
    expect(MESSAGE_TYPES.PICK_RESULT).toBe('pick-result')
    expect(MESSAGE_TYPES.TOOL_ACTIVATED).toBe('tool-activated')
    expect(MESSAGE_TYPES.PROGRESS).toBe('progress')
    expect(MESSAGE_TYPES.MEDIA_CLICKED).toBe('media-clicked')
    expect(MESSAGE_TYPES.MARKER_CLICKED).toBe('marker-clicked')
  })

  it('should construct valid LoadModelPayload', () => {
    const payload: LoadModelPayload = { url: 'http://example.com/model.glb', format: 'glb' }
    expect(payload.url).toBe('http://example.com/model.glb')
    expect(payload.format).toBe('glb')
  })

  it('should construct valid SetEnvironmentPayload', () => {
    const payload: SetEnvironmentPayload = {
      preset: 'city',
      lighting: {
        ambientColor: '#ffffff',
        ambientIntensity: 0.5,
        directionalColor: '#ffffff',
        directionalIntensity: 1.0,
      },
    }
    expect(payload.preset).toBe('city')
    expect(payload.lighting?.ambientIntensity).toBe(0.5)
  })

  it('should construct valid ToolConfigPayload', () => {
    const payload: ToolConfigPayload = {
      visible: ['navigation', 'picking'],
      hidden: ['measurement'],
    }
    expect(payload.visible).toEqual(['navigation', 'picking'])
    expect(payload.hidden).toEqual(['measurement'])
  })

  it('should construct valid SetCameraPayload', () => {
    const payload: SetCameraPayload = {
      position: [10, 10, 10],
      target: [0, 0, 0],
    }
    expect(payload.position).toEqual([10, 10, 10])
    expect(payload.target).toEqual([0, 0, 0])
  })

  it('should construct valid SetSectionPayload', () => {
    const payload: SetSectionPayload = {
      mode: 'axis',
      axis: 'x',
      position: 5,
      enabled: true,
    }
    expect(payload.mode).toBe('axis')
    expect(payload.axis).toBe('x')
    expect(payload.enabled).toBe(true)
  })

  it('should construct valid ModelLoadedPayload', () => {
    const payload: ModelLoadedPayload = {
      metadata: {
        name: 'building',
        size: 1024,
        vertices: 10000,
        boundingBox: {
          min: [-10, -10, -10],
          max: [10, 10, 10],
        },
      },
    }
    expect(payload.metadata.name).toBe('building')
    expect(payload.metadata.boundingBox.min).toEqual([-10, -10, -10])
  })

  it('should construct valid ModelErrorPayload', () => {
    const payload: ModelErrorPayload = {
      url: 'http://example.com/broken.glb',
      error: 'Failed to load',
    }
    expect(payload.error).toBe('Failed to load')
  })

  it('should construct valid ProgressPayload', () => {
    const payload: ProgressPayload = {
      loaded: 50,
      total: 100,
      percent: 50,
    }
    expect(payload.percent).toBe(50)
  })

  it('should construct valid MediaClickedPayload', () => {
    const payload: MediaClickedPayload = {
      id: 'media-1',
      type: 'image',
      name: '示例图片',
      url: 'http://example.com/img.jpg',
    }
    expect(payload.type).toBe('image')
    expect(payload.name).toBe('示例图片')
  })

  it('should construct valid MarkerClickedPayload', () => {
    const payload: MarkerClickedPayload = {
      id: 'marker-1',
      name: '标注点',
      position: [1, 2, 3],
      action: 'open',
      popup: { title: '标题', content: '内容' },
    }
    expect(payload.position).toEqual([1, 2, 3])
    expect(payload.popup?.title).toBe('标题')
  })
})
