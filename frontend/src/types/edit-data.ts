export interface ComponentEdit {
  transform: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
  material: {
    color: string | null
    opacity: number | null
    mapUrl: string | null
    normalMapUrl: string | null
    roughnessMapUrl: string | null
    metalnessMapUrl: string | null
    emissiveMapUrl: string | null
  }
  visible: boolean
  name: string | null
  description: string | null
}

/** 标点弹窗自定义样式 */
export interface MarkerPopupStyle {
  width?: number
  background?: string
  textColor?: string
  borderRadius?: number
  fontSize?: number
}

export interface MarkerPopup {
  title: string
  content: string
  contentUrl?: string
  style?: MarkerPopupStyle
}

export interface MarkerImage {
  id: string
  url: string
  name?: string
  state?: string
}

export interface MarkerData {
  id: string
  position: [number, number, number]
  imageUrl: string
  width: number
  height: number
  name: string
  action: 'popup' | 'link' | 'none'
  state?: string
  popup?: MarkerPopup
  linkUrl?: string
  linkTarget?: '_blank' | '_self'
  images?: MarkerImage[]
}

export type SceneMediaType = 'image' | 'video' | 'text'

export interface SceneMedia {
  id: string
  /** 媒体类型 */
  type: SceneMediaType
  /** 资源 URL（图片/视频） */
  url?: string
  name: string
  width: number
  height: number
  position?: [number, number, number]
  /** 缩放 (X, Y)，平面无厚度 */
  scale?: [number, number]
  /** 旋转 (X, Y, Z) 欧拉角，弧度 */
  rotation?: [number, number, number]
  visible: boolean
  /** true = 始终面向相机（广告牌），false = 嵌入场景（固定朝向） */
  billboard?: boolean
  // 视频专用
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  // 文字标注专用
  text?: string
  fontSize?: number
  fontColor?: string
}

/** 兼容旧数据 */
export type SceneImage = SceneMedia

export interface EditData {
  version: 2
  modelUrl: string
  backgroundColor: string
  autoRotate: boolean
  components: Record<string, ComponentEdit>
  markers: MarkerData[]
}
