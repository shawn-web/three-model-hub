import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  ValidateNested,
  IsIn,
  ArrayMaxSize,
} from 'class-validator'
import { Type } from 'class-transformer'

/**
 * Geo 视角配置 DTO（相机飞行参数）
 */
export class GeoCameraDto {
  @IsNumber()
  longitude!: number

  @IsNumber()
  latitude!: number

  @IsNumber()
  altitude!: number

  @IsOptional()
  @IsNumber()
  heading?: number

  @IsOptional()
  @IsNumber()
  pitch?: number

  @IsOptional()
  @IsNumber()
  range?: number
}

/**
 * Geo 底图配置 DTO
 *
 * 结构化校验 config.geo 的关键字段，替代原来的 Record<string, any>。
 * allowedOrigins 统一为 string[] | null：
 *   - null = 走 referrer 默认
 *   - []   = 拒绝全部
 *   - 非空 = 白名单
 */
export class GeoConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsObject()
  origin?: Record<string, unknown>

  @IsOptional()
  @IsString()
  imageryProvider?: string

  @IsOptional()
  @IsIn(['satellite', 'vector', 'terrain'])
  imageryType?: 'satellite' | 'vector' | 'terrain'

  @IsOptional()
  @IsBoolean()
  toolbar?: boolean

  @IsOptional()
  @IsBoolean()
  panel?: boolean

  @IsOptional()
  @IsObject()
  viewpoint?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  markers?: unknown[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lockedModelIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleModelIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenTools?: string[]

  @IsOptional()
  @IsBoolean()
  showMarkers?: boolean

  /** 允许的 postMessage 来源域名，null = 走 referrer，[] = 拒绝全部 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  allowedOrigins?: string[]

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoCameraDto)
  camera?: GeoCameraDto
}
