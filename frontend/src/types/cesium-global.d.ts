/**
 * Cesium 全局类型声明
 * Cesium 通过动态 script 标签全局加载，不使用 import('cesium')
 * 所有类型标记为 any，避免 Vite/Rolldown 扫描 cesium 包导致构建崩溃
 */

export {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCesiumClass = any

interface CesiumNamespace {
  Viewer: AnyCesiumClass
  WebMapTileServiceImageryProvider: AnyCesiumClass
  ImageryLayer: AnyCesiumClass
  Cartesian3: AnyCesiumClass
  Cartographic: AnyCesiumClass
  HeadingPitchRoll: AnyCesiumClass
  Color: AnyCesiumClass
  Credit: AnyCesiumClass
  Entity: AnyCesiumClass
  ShadowMode: AnyCesiumClass
  ConstantPositionProperty: AnyCesiumClass
  ConstantProperty: AnyCesiumClass
  Math: AnyCesiumClass
  ScreenSpaceEventHandler: AnyCesiumClass
  ScreenSpaceEventType: AnyCesiumClass
  Transforms: AnyCesiumClass
  SceneTransforms: AnyCesiumClass
  VerticalOrigin: AnyCesiumClass
  HeightReference: AnyCesiumClass
  BoundingSphere: AnyCesiumClass
  [key: string]: unknown
}

declare global {
  interface Window {
    Cesium: CesiumNamespace
  }
}
