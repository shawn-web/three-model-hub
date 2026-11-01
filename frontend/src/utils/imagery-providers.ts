/**
 * 地图底图厂商注册表
 * 提供可插拔的地图影像 Provider 管理，每个厂商定义卫星、矢量、标注三个图层
 * Cesium 通过 index.html 全局加载
 */

import { getCs } from './cesium-instance'

/** 地图底图厂商配置 */
export interface ImageryProviderConfig {
  /** 厂商唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 创建卫星影像图层 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  satellite: () => any
  /** 创建路网矢量图层 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vector: () => any
  /** 创建地形图层 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  terrain: () => any
  /** 创建标注叠加图层（可选） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annotation?: () => any
  /**
   * 卫星模式下叠加半透明矢量参考层（可选）
   * 用于解决卫星影像与矢量路网地理配准偏差问题
   * 返回 [provider, alpha] 或 null
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vectorOverlay?: () => { provider: any; alpha: number } | null
  /**
   * 地形模式下叠加注记图层（可选）
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  terrainAnnotation?: () => any
}

// ── 天地图 Provider ──────────────────────────────────────

const TIANDITU_TOKEN = import.meta.env.VITE_TIANDITU_TOKEN as string | undefined

if (!TIANDITU_TOKEN && import.meta.env.DEV) {
  console.warn('[imagery] 未配置 VITE_TIANDITU_TOKEN，天地图底图将加载失败（tk=undefined 会导致 418）。请在 frontend/.env 中设置该变量。')
}

/** 天地图通用 WMTS 参数 */
const TIANDITU_COMMON = {
  style: 'default',
  tileMatrixSetID: 'w',
  format: 'tiles',
  subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
  /** 天地图 WMTS 最高支持 18 级缩放 */
  maximumLevel: 18,
}

const tianditu: ImageryProviderConfig = {
  id: 'tianditu',
  name: '天地图',
  satellite: () => {
    const C = getCs()
    return new C.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TIANDITU_TOKEN}`,
      layer: 'img',
      ...TIANDITU_COMMON,
      credit: new C.Credit('天地图影像'),
    })
  },
  vector: () => {
    const C = getCs()
    return new C.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TIANDITU_TOKEN}`,
      layer: 'vec',
      ...TIANDITU_COMMON,
      credit: new C.Credit('天地图矢量'),
    })
  },
  terrain: () => {
    const C = getCs()
    return new C.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TIANDITU_TOKEN}`,
      layer: 'ter',
      ...TIANDITU_COMMON,
      credit: new C.Credit('天地图地形'),
    })
  },
  annotation: () => {
    const C = getCs()
    return new C.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TIANDITU_TOKEN}`,
      layer: 'cia',
      ...TIANDITU_COMMON,
      credit: new C.Credit('天地图注记'),
    })
  },
  /** 卫星模式下叠加半透明矢量路网参考层 */
  vectorOverlay: () => {
    const C = getCs()
    return {
      provider: new C.WebMapTileServiceImageryProvider({
        url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TIANDITU_TOKEN}`,
        layer: 'vec',
        ...TIANDITU_COMMON,
        credit: new C.Credit('天地图矢量参考'),
      }),
      alpha: 0.35,
    }
  },
  /** 地形模式下叠加注记图层 */
  terrainAnnotation: () => {
    const C = getCs()
    return new C.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${TIANDITU_TOKEN}`,
      layer: 'cta',
      ...TIANDITU_COMMON,
      credit: new C.Credit('天地图地形注记'),
    })
  },
}

// ── 谷歌地图 Provider ────────────────────────────────────

const google: ImageryProviderConfig = {
  id: 'google',
  name: '谷歌地图',
  satellite: () => {
    const C = getCs()
    return new C.UrlTemplateImageryProvider({
      url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      credit: new C.Credit('Google Maps Satellite'),
    })
  },
  vector: () => {
    const C = getCs()
    return new C.UrlTemplateImageryProvider({
      url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      credit: new C.Credit('Google Maps'),
    })
  },
  terrain: () => {
    const C = getCs()
    return new C.UrlTemplateImageryProvider({
      url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      credit: new C.Credit('Google Maps Terrain'),
    })
  },
  annotation: () => {
    const C = getCs()
    return new C.UrlTemplateImageryProvider({
      url: 'https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
      subdomains: ['0', '1', '2', '3'],
      credit: new C.Credit('Google Maps Labels'),
    })
  },
  /** 卫星模式下叠加半透明矢量路网参考层 */
  vectorOverlay: () => {
    const C = getCs()
    return {
      provider: new C.UrlTemplateImageryProvider({
        url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        subdomains: ['0', '1', '2', '3'],
        credit: new C.Credit('Google Maps Vector Reference'),
      }),
      alpha: 0.35,
    }
  },
}

// ── 注册表 ───────────────────────────────────────────────

const registry = new Map<string, ImageryProviderConfig>()
registry.set(tianditu.id, tianditu)
registry.set(google.id, google)

/** 获取指定厂商配置 */
export function getImageryProvider(providerId: string): ImageryProviderConfig {
  const provider = registry.get(providerId)
  if (!provider) throw new Error(`未知的地图厂商: ${providerId}`)
  return provider
}

/** 获取所有可用厂商列表（用于 UI 渲染） */
export function getImageryProviderList(): ImageryProviderConfig[] {
  return Array.from(registry.values())
}

/** 默认厂商 ID */
export const DEFAULT_PROVIDER_ID: 'tianditu'|'google' = 'tianditu'
