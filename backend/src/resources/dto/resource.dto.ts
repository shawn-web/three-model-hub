import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator'
import { ResourceType } from '../entities/resource.entity'

/**
 * 上传资源 DTO（前端分片上传完成后落库）
 *
 * 流程：
 *   1. 前端先调 /upload/multipart/* 完成上传，拿 { url, fileKey, fileSize }
 *   2. 再调 POST /resources/upload 带本 DTO 落库
 */
export class UploadResourceDto {
  @IsString()
  name: string

  @IsEnum(ResourceType)
  type: ResourceType

  @IsString()
  url: string

  @IsString()
  file_key: string

  @IsNumber()
  @Min(1)
  @Max(10737418240) // 10GB
  file_size: number

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
  group_id?: string
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
