/**
 * 创建场景 DTO
 */
export class CreateSceneDto {
  name: string
  description?: string
  scene_config?: Record<string, any>
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
