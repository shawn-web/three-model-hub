/**
 * Geo 标点类型定义
 * 用于 Cesium 3D 地球上的地图标点系统，独立于场景编辑器的 Three.js Marker
 */

/** Geo 标点弹窗样式 */
export interface GeoMarkerPopupStyle {
  /** 弹窗宽度 px，默认 280 */
  width?: number
  /** 弹窗高度 px，空=自适应 */
  height?: number
  /** 背景色，默认 'rgba(20, 20, 30, 0.92)' */
  background?: string
  /** 文字颜色，默认 '#eee' */
  textColor?: string
  /** 圆角 px，默认 10 */
  borderRadius?: number
  /** 字号 px，默认 13 */
  fontSize?: number
  /** 内边距 px，默认 12 */
  padding?: number
  /** 边框色 */
  borderColor?: string
  /** 是否显示阴影，默认 true */
  shadow?: boolean
  /** 标题对齐方式 */
  titleAlign?: 'left' | 'center' | 'right'
  /** 内容对齐方式 */
  contentAlign?: 'left' | 'center' | 'right'
}

/** Geo 标点弹窗内容 */
export interface GeoMarkerPopup {
  /** 弹窗标题 */
  title: string
  /** 弹窗正文 */
  content: string
  /** 可选：弹窗内嵌入的 iframe 链接 */
  contentUrl?: string
  /** 弹窗内显示的图片 URL（单图快捷字段） */
  imageUrl?: string
  /** 弹窗底部跳转链接 */
  linkUrl?: string
  /** 弹窗样式 */
  style?: GeoMarkerPopupStyle
}

/** Geo 标点 iframe 弹窗配置 */
export interface GeoMarkerIframe {
  /** iframe URL */
  url: string
  /** 宽度 px，默认 400 */
  width?: number
  /** 高度 px，默认 300 */
  height?: number
  /** 是否显示关闭按钮，默认 true */
  showCloseButton?: boolean
  /** 关闭按钮位置 */
  closeButtonPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

/** Geo 标点关联图片 */
export interface GeoMarkerImage {
  /** 图片 ID */
  id: string
  /** 图片 URL */
  url: string
  /** 图片名称 */
  name?: string
}

/** Geo 标点数据（独立于 Three.js 场景编辑器的 MarkerData） */
export interface GeoMarkerData {
  /** 标点唯一 ID */
  id: string
  /** 标点名称 */
  name: string
  /** 经度 WGS84 */
  longitude: number
  /** 纬度 WGS84 */
  latitude: number
  /** 海拔（米） */
  altitude: number
  /** 点击行为类型 */
  action: 'popup' | 'link' | 'iframe' | 'none'
  /** 弹窗配置（action='popup' 时有效） */
  popup?: GeoMarkerPopup
  /** iframe 配置（action='iframe' 时有效） */
  iframe?: GeoMarkerIframe
  /** 跳转链接（action='link' 时有效） */
  linkUrl?: string
  /** 链接打开方式 */
  linkTarget?: '_blank' | '_self'
  /** 标点图标 URL（空则用内置 Canvas 绘制的红色 pin） */
  iconUrl?: string
  /** 图标缩放倍率，默认 1.0 */
  iconScale?: number
  /** 多图片列表（弹窗中可展示的图片集合） */
  images?: GeoMarkerImage[]
}

/** 弹窗激活目标（标点或模型） */
export type PopupTarget =
  | { type: 'marker'; id: string }
  | { type: 'model'; id: string }
  | null
