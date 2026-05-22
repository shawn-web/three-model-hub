/**
 * 共享光源配置与辅助函数
 * 编辑器和预览器共用，保持光源行为一致
 */

/** 默认光源强度值 */
export const LIGHT_DEFAULTS = {
  /** 环境光基础强度 */
  ambientIntensity: 0.8,
  /** 半球光基础强度 */
  hemisphereIntensity: 0.5,
  /** 主方向光强度 */
  mainDirectional: 1.2,
  /** 对侧补充光强度 */
  fillDirectional: 0.6,
  /** 底部补光强度 */
  bottomDirectional: 0.5,
  /** 色调映射曝光度 */
  toneMappingExposure: 1.3,
  /** 默认光源颜色 */
  lightColor: '#ffffff',
} as const

/** 主光源位置（投射阴影） */
export const MAIN_LIGHT_POS: [number, number, number] = [50, 50, 25]

/** 对侧补充光位置 */
export const FILL_LIGHT_POS: [number, number, number] = [-30, 20, -30]

/** 底部补光位置 */
export const BOTTOM_LIGHT_POS: [number, number, number] = [10, -15, -10]

/** 阴影贴图配置 */
export const SHADOW_CONFIG = {
  mapSize: 2048,
  cameraFar: 200,
  cameraSize: 50,
} as const

/**
 * 计算预览页光源参数
 * 模型预览使用固定默认值，场景预览使用场景配置值
 */
export function resolveLighting(params: {
  isModelPreview: boolean
  sceneConfig?: Record<string, unknown> | null
}) {
  const { isModelPreview, sceneConfig } = params
  return {
    ambientIntensity: isModelPreview
      ? LIGHT_DEFAULTS.ambientIntensity
      : (sceneConfig?.ambientIntensity ?? LIGHT_DEFAULTS.ambientIntensity),
    lightIntensity: isModelPreview
      ? 1.0
      : (sceneConfig?.lightIntensity ?? 1.0),
    lightColor: isModelPreview
      ? LIGHT_DEFAULTS.lightColor
      : (sceneConfig?.lightColor ?? LIGHT_DEFAULTS.lightColor),
  }
}

/**
 * 计算编辑器页光源参数（直接从 store 取值）
 */
export function resolveEditLighting(params: {
  ambientIntensity: number
  lightIntensity: number
  lightColor: string
}) {
  return {
    ambientIntensity: params.ambientIntensity,
    lightIntensity: params.lightIntensity,
    lightColor: params.lightColor,
  }
}
