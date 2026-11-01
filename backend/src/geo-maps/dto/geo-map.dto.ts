import { IsString, IsOptional, IsNumber, IsObject, IsArray, ValidateNested, ValidateIf, ArrayMaxSize } from 'class-validator'
import { Type } from 'class-transformer'
import { GeoConfigDto } from './geo-config.dto'
import { GeoPositionDto } from '../../scenes/dto/geo-position.dto'

/**
 * 创建地图 DTO
 */
export class CreateGeoMapDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>
}

/**
 * 更新地图 DTO
 */
export class UpdateGeoMapDto {
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
  config?: Record<string, unknown>
}

/**
 * 添加模型到地�?DTO
 */
export class AddGeoMapModelDto {
  @IsString()
  model_id: string

  @IsOptional()
  @IsString()
  model_version_id?: string

  @IsOptional()
  @IsString()
  display_name?: string

  @IsOptional()
  @ValidateIf((o) => o.geo_position !== null)
  @ValidateNested()
  @Type(() => GeoPositionDto)
  geo_position?: GeoPositionDto | null

  @IsOptional()
  visible?: boolean

  @IsOptional()
  @IsNumber()
  sort_order?: number
}

/**
 * 更新地图中的模型 DTO
 */
export class UpdateGeoMapModelDto {
  @IsOptional()
  @IsString()
  display_name?: string

  @IsOptional()
  @ValidateIf((o) => o.geo_position !== null)
  @ValidateNested()
  @Type(() => GeoPositionDto)
  geo_position?: GeoPositionDto | null

  @IsOptional()
  visible?: boolean

  @IsOptional()
  @IsNumber()
  sort_order?: number
}

/** 批量更新地图模型 DTO 中的单项 */
export class BatchGeoMapModelItemDto {
  @IsString()
  id: string

  @IsOptional()
  @IsString()
  display_name?: string

  @IsOptional()
  @ValidateIf((o) => o.geo_position !== null)
  @ValidateNested()
  @Type(() => GeoPositionDto)
  geo_position?: GeoPositionDto | null

  @IsOptional()
  visible?: boolean
}

/** 批量更新地图模型 DTO */
export class BatchUpdateGeoMapModelsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BatchGeoMapModelItemDto)
  models: BatchGeoMapModelItemDto[]
}

/** Geo 统一保存 DTO（原子操作：同时保存模型坐标 + 底图配置�?*/
export class SaveGeoMapConfigDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BatchGeoMapModelItemDto)
  models: BatchGeoMapModelItemDto[]

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoConfigDto)
  geoConfig?: GeoConfigDto
}
