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

// Geo 页面 payloads

/** Geo 页面配置（父页面 → iframe） */
export interface GeoConfigPayload {
  imagery?: string
  imageryType?: 'satellite' | 'vector' | 'terrain'
  toolbar?: boolean
  panel?: boolean
  // ---- 视角控制 ----
  camera?: {
    longitude: number
    latitude: number
    altitude: number
    heading?: number
    pitch?: number
    range?: number
  }
  // ---- 模型可见性控制 ----
  visibleModelIds?: string[] | null
  // ---- 工具栏精细控制 ----
  hiddenTools?: string[]
  // ---- 标注显示 ----
  showMarkers?: boolean
  // ---- 安全 ----
  allowedOrigins?: string[]
}

/** Geo 页面就绪通知（iframe → 父页面） */
export interface GeoReadyPayload {
  mapId: string
}

/** Geo 模型位置变更通知（iframe → 父页面） */
export interface GeoPositionChangedPayload {
  modelId: string
  geo_position: Record<string, unknown> | null
}

/** Geo 模型加载完成通知 */
export interface GeoModelsLoadedPayload {
  mapId: string
  modelCount: number
}

/** Geo 模型点击通知 */
export interface GeoModelClickedPayload {
  modelId: string
  type: 'selected' | 'deselected'
}

/** Geo 保存完成通知 */
export interface GeoSavedPayload {
  mapId: string
  savedModelCount: number
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
  // Geo 页面消息类型
  GEO_READY: 'geo-ready',
  GEO_CONFIG: 'geo-config',
  GEO_POSITION_CHANGED: 'geo-position-changed',
  GEO_MODELS_LOADED: 'geo-models-loaded',
  GEO_MODEL_CLICKED: 'geo-model-clicked',
  GEO_SAVED: 'geo-saved',
} as const

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES]
