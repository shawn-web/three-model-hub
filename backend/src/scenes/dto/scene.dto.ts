/**
 * 创建场景 DTO
 */
export class CreateSceneDto {
  name: string
  description?: string
  scene_config?: Record<string, any>
  markers?: Record<string, any>
}

/**
 * 更新场景 DTO
 */
export class UpdateSceneDto {
  name?: string
  description?: string
  thumbnail_url?: string
  scene_config?: Record<string, any>
  is_public?: boolean
  markers?: Record<string, any>
}

/**
 * 添加模型到场景 DTO
 */
export class AddSceneModelDto {
  model_id: string
  model_version_id?: string
  transform?: Record<string, any>
  material_overrides?: Record<string, any>
  visible?: boolean
  sort_order?: number
  display_name?: string
}

/**
 * 更新场景中的模型 DTO
 */
export class UpdateSceneModelDto {
  transform?: Record<string, any>
  material_overrides?: Record<string, any>
  visible?: boolean
  sort_order?: number
  display_name?: string
}

/** 批量更新场景模型 DTO 中的单项 */
export class BatchSceneModelItemDto {
  id: string
  transform?: Record<string, any>
  material_overrides?: Record<string, any>
  visible?: boolean
  display_name?: string
}

/** 批量更新场景模型 DTO */
export class BatchUpdateSceneModelsDto {
  models: BatchSceneModelItemDto[]
}

/**
 * 添加场景媒体 DTO
 */
export class AddSceneImageDto {
  type?: string
  url?: string
  name: string
  width: number
  height: number
  position?: Record<string, any>
  scale?: Record<string, any>
  rotation?: Record<string, any>
  visible?: boolean
  billboard?: boolean
  sort_order?: number
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  text?: string
  fontSize?: number
  fontColor?: string
  iframeUrl?: string
}

/**
 * 更新场景媒体 DTO
 */
export class UpdateSceneImageDto {
  type?: string
  url?: string
  name?: string
  width?: number
  height?: number
  position?: Record<string, any>
  scale?: Record<string, any>
  rotation?: Record<string, any>
  visible?: boolean
  billboard?: boolean
  sort_order?: number
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  text?: string
  fontSize?: number
  fontColor?: string
  iframeUrl?: string
}

/** 批量保存场景媒体 DTO 中的单项 */
export class BatchSceneImageItemDto {
  type?: string
  url?: string
  name: string
  width: number
  height: number
  position?: Record<string, any>
  scale?: Record<string, any>
  rotation?: Record<string, any>
  visible?: boolean
  billboard?: boolean
  sort_order?: number
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  text?: string
  fontSize?: number
  fontColor?: string
  iframeUrl?: string
}

/** 批量保存场景媒体 DTO */
export class BatchSaveSceneImagesDto {
  images: BatchSceneImageItemDto[]
}
