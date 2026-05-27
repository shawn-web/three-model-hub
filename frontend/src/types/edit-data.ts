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
  height?: number
  background?: string
  textColor?: string
  borderRadius?: number
  fontSize?: number
  padding?: number
  borderColor?: string
  shadow?: boolean
  titleAlign?: 'left' | 'center' | 'right'
  contentAlign?: 'left' | 'center' | 'right'
}

export interface MarkerPopup {
  title: string
  content: string
  contentUrl?: string
  style?: MarkerPopupStyle
}

/** 纯 iframe 弹窗配置 */
export interface MarkerIframe {
  /** iframe 地址 */
  url: string
  /** 弹窗宽度（px），默认 400 */
  width?: number
  /** 弹窗高度（px），默认 300 */
  height?: number
  /** 是否显示关闭按钮，默认 true */
  showCloseButton?: boolean
  /** 关闭按钮图片 URL，未设置时使用默认符号 */
  closeButtonImage?: string
  /** 关闭按钮位置，默认 'top-right' */
  closeButtonPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
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
  action: 'popup' | 'link' | 'iframe' | 'none'
  state?: string
  popup?: MarkerPopup
  iframe?: MarkerIframe
  linkUrl?: string
  linkTarget?: '_blank' | '_self'
  images?: MarkerImage[]
  /** 图标不透明度 (0~1)，默认 1 */
  opacity?: number
  /** 图标形状裁切 */
  shape?: 'original' | 'circle' | 'rounded'
  /** 偏移高度：标点沿 Y 轴上移的距离 */
  offset?: number
  /** 固定大小：不随相机距离缩放 */
  fixedSize?: boolean
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
