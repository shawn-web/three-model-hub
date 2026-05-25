import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * 创建场景 DTO
 */
export class CreateSceneDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsObject()
  scene_config?: Record<string, any>

  @IsOptional()
  markers?: Record<string, any>
}

/**
 * 更新场景 DTO
 */
export class UpdateSceneDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  thumbnail_url?: string

  @IsOptional()
  @IsObject()
  scene_config?: Record<string, any>

  @IsOptional()
  is_public?: boolean

  @IsOptional()
  markers?: Record<string, any>
}

/**
 * 添加模型到场景 DTO
 */
export class AddSceneModelDto {
  @IsString()
  model_id: string

  @IsOptional()
  @IsString()
  model_version_id?: string

  @IsOptional()
  @IsObject()
  transform?: Record<string, any>

  @IsOptional()
  @IsObject()
  material_overrides?: Record<string, any>

  @IsOptional()
  visible?: boolean

  @IsOptional()
  @IsNumber()
  sort_order?: number

  @IsOptional()
  @IsString()
  display_name?: string
}

/**
 * 更新场景中的模型 DTO
 */
export class UpdateSceneModelDto {
  @IsOptional()
  @IsObject()
  transform?: Record<string, any>

  @IsOptional()
  @IsObject()
  material_overrides?: Record<string, any>

  @IsOptional()
  visible?: boolean

  @IsOptional()
  @IsNumber()
  sort_order?: number

  @IsOptional()
  @IsString()
  display_name?: string
}

/** 批量更新场景模型 DTO 中的单项 */
export class BatchSceneModelItemDto {
  @IsString()
  id: string

  @IsOptional()
  @IsObject()
  transform?: Record<string, any>

  @IsOptional()
  @IsObject()
  material_overrides?: Record<string, any>

  @IsOptional()
  visible?: boolean

  @IsOptional()
  @IsString()
  display_name?: string
}

/** 批量更新场景模型 DTO */
export class BatchUpdateSceneModelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchSceneModelItemDto)
  models: BatchSceneModelItemDto[]
}

/**
 * 添加场景媒体 DTO
 */
export class AddSceneImageDto {
  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsString()
  url?: string

  @IsString()
  name: string

  @IsNumber()
  width: number

  @IsNumber()
  height: number

  @IsOptional()
  @IsObject()
  position?: Record<string, any>

  @IsOptional()
  @IsObject()
  scale?: Record<string, any>

  @IsOptional()
  @IsObject()
  rotation?: Record<string, any>

  @IsOptional()
  visible?: boolean

  @IsOptional()
  billboard?: boolean

  @IsOptional()
  @IsNumber()
  sort_order?: number

  @IsOptional()
  autoplay?: boolean

  @IsOptional()
  muted?: boolean

  @IsOptional()
  loop?: boolean

  @IsOptional()
  @IsString()
  text?: string

  @IsOptional()
  @IsNumber()
  fontSize?: number

  @IsOptional()
  @IsString()
  fontColor?: string

  @IsOptional()
  @IsString()
  iframeUrl?: string
}

/**
 * 更新场景媒体 DTO
 */
export class UpdateSceneImageDto {
  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsString()
  url?: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsNumber()
  width?: number

  @IsOptional()
  @IsNumber()
  height?: number

  @IsOptional()
  @IsObject()
  position?: Record<string, any>

  @IsOptional()
  @IsObject()
  scale?: Record<string, any>

  @IsOptional()
  @IsObject()
  rotation?: Record<string, any>

  @IsOptional()
  visible?: boolean

  @IsOptional()
  billboard?: boolean

  @IsOptional()
  @IsNumber()
  sort_order?: number

  @IsOptional()
  autoplay?: boolean

  @IsOptional()
  muted?: boolean

  @IsOptional()
  loop?: boolean

  @IsOptional()
  @IsString()
  text?: string

  @IsOptional()
  @IsNumber()
  fontSize?: number

  @IsOptional()
  @IsString()
  fontColor?: string

  @IsOptional()
  @IsString()
  iframeUrl?: string
}

/** 批量保存场景媒体 DTO 中的单项 */
export class BatchSceneImageItemDto {
  @IsOptional()
  @IsString()
  id?: string

  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsString()
  url?: string

  @IsString()
  name: string

  @IsNumber()
  width: number

  @IsNumber()
  height: number

  @IsOptional()
  @IsObject()
  position?: Record<string, any>

  @IsOptional()
  @IsObject()
  scale?: Record<string, any>

  @IsOptional()
  @IsObject()
  rotation?: Record<string, any>

  @IsOptional()
  visible?: boolean

  @IsOptional()
  billboard?: boolean

  @IsOptional()
  @IsNumber()
  sort_order?: number

  @IsOptional()
  autoplay?: boolean

  @IsOptional()
  muted?: boolean

  @IsOptional()
  loop?: boolean

  @IsOptional()
  @IsString()
  text?: string

  @IsOptional()
  @IsNumber()
  fontSize?: number

  @IsOptional()
  @IsString()
  fontColor?: string

  @IsOptional()
  @IsString()
  iframeUrl?: string
}

/** 批量保存场景媒体 DTO */
export class BatchSaveSceneImagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchSceneImageItemDto)
  images: BatchSceneImageItemDto[]
}
