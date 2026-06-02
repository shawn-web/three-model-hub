export interface ViewerMessage {
  type: string
  payload: unknown
  requestId?: string
}

// Parent -> iframe payloads
export interface LoadModelPayload {
  url: string
  format?: string
}

export interface SetEnvironmentPayload {
  preset?: string
  skybox?: string
  lighting?: {
    ambientColor?: string
    ambientIntensity?: number
    directionalColor?: string
    directionalIntensity?: number
  }
}

export interface ToolConfigPayload {
  visible?: string[]
  hidden?: string[]
}

export interface ToolActivatePayload {
  toolId: string
}

export interface SetCameraPayload {
  position: [number, number, number]
  target: [number, number, number]
}

export interface SetSectionPayload {
  mode: 'box' | 'axis' | 'face'
  axis?: 'x' | 'y' | 'z'
  position?: number
  normal?: [number, number, number]
  enabled: boolean
}

// iframe -> Parent payloads
export interface ModelLoadedPayload {
  metadata: {
    name: string
    size: number
    vertices: number
    boundingBox: {
      min: [number, number, number]
      max: [number, number, number]
    }
  }
}

export interface ModelErrorPayload {
  url: string
  error: string
}

export interface PickResultPayload {
  objectId: string | null
  info: Record<string, unknown>
}

export interface ProgressPayload {
  loaded: number
  total: number
  percent: number
}

export interface MediaClickedPayload {
  id: string
  type: string
  name: string
  url?: string
  text?: string
}

export interface MarkerClickedPayload {
  id: string
  name: string
  position: [number, number, number]
  action: string
  popup?: { title?: string; content?: string; contentUrl?: string }
  linkUrl?: string
}

// Message type constants
export const MESSAGE_TYPES = {
  LOAD_MODEL: 'load-model',
  UNLOAD_MODEL: 'unload-model',
  SET_ENVIRONMENT: 'set-environment',
  TOOL_CONFIG: 'tool-config',
  TOOL_ACTIVATE: 'tool-activate',
  SET_CAMERA: 'set-camera',
  SET_SECTION: 'set-section',
  VIEWER_READY: 'viewer-ready',
  MODEL_LOADED: 'model-loaded',
  MODEL_ERROR: 'model-error',
  PICK_RESULT: 'pick-result',
  TOOL_ACTIVATED: 'tool-activated',
  PROGRESS: 'progress',
  MEDIA_CLICKED: 'media-clicked',
  MARKER_CLICKED: 'marker-clicked',
} as const

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES]
