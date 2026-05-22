import type { BackgroundConfig } from '../store/edit-store'

/** 相机配置 */
export interface CameraConfig {
  position: [number, number, number]
  fov: number
  near: number
  far: number
  savedConfig?: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    fov?: number
  } | null
}

/** 光照配置 */
export interface LightingConfig {
  ambientIntensity: number
  lightIntensity: number
  lightColor: string
}

/** 插件配置 */
export interface PluginsConfig {
  viewCube: boolean
  autoRotate: { enabled: boolean; axis: 'x' | 'y' | 'z'; speed: number }
  grid: boolean
  xray: boolean
  transformControls: boolean
  cameraInfo: boolean
  rotationMode: boolean
  screenshot: boolean
  picking: boolean
  section: boolean
  measurement: boolean
  navigation: boolean
  markerPlacement: boolean
  imagePlacement: boolean
}

/** 场景渲染配置 */
export interface SceneSetupConfig {
  mode: 'edit' | 'view'
  lighting: LightingConfig
  background: BackgroundConfig | null
  camera: CameraConfig
  plugins: PluginsConfig
  editTab?: string
}
