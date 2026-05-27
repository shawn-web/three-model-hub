import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator'
import { ResourceType } from '../entities/resource.entity'

/** 创建资源 DTO */
export class CreateResourceDto {
  @IsString()
  name: string

  @IsEnum(ResourceType)
  type: ResourceType

  @IsString()
  url: string

  @IsOptional()
  @IsNumber()
  file_size?: number

  @IsOptional()
  @IsString()
  mime_type?: string

  @IsOptional()
  @IsNumber()
  width?: number

  @IsOptional()
  @IsNumber()
  height?: number

  @IsOptional()
  @IsNumber()
  duration?: number

  @IsOptional()
  @IsString()
  thumbnail_url?: string

  @IsOptional()
  @IsString()
  group_id?: string

  @IsOptional()
  @IsString()
  file_key?: string
}

/** 更新资源 DTO */
export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  group_id?: string
}

/** 创建资源分组 DTO */
export class CreateResourceGroupDto {
  @IsString()
  name: string

  @IsOptional()
  @IsNumber()
  sort_order?: number
}

/** 更新资源分组 DTO */
export class UpdateResourceGroupDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsNumber()
  sort_order?: number
}
