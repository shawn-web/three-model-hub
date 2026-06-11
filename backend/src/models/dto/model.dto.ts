import { IsString, IsOptional, IsArray, IsNumber, Min, Max } from 'class-validator'

/** 全局文件大小上限（MB → 字节） */
const MAX_UPLOAD_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '1024', 10) * 1024 * 1024

/**
 * 创建模型 DTO
 */
export class CreateModelDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsString()
  commit_message?: string
}

/**
 * 更新模型 DTO
 */
export class UpdateModelDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsString()
  thumbnail_url?: string

  @IsOptional()
  is_public?: boolean
}

/**
 * 上传新版本 DTO
 */
export class CreateVersionDto {
  @IsOptional()
  @IsString()
  commit_message?: string
}

/**
 * 前端分片上传完成后创建模型 DTO
 *
 * 流程：
 *   1. 前端先调 /upload/multipart/* 完成上传，拿 { url, fileKey, fileSize }
 *   2. 再调 POST /models/create 带本 DTO 落库
 */
export class CreateFromUrlDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  /** MinIO 公开访问 URL */
  @IsString()
  file_url: string

  @IsString()
  file_name: string

  @IsNumber()
  @Min(1, { message: '文件大小必须大于 0' })
  @Max(MAX_UPLOAD_SIZE_BYTES, { message: `文件大小不能超过 ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB` })
  file_size: number

  /** MinIO objectKey（用于删除/复制） */
  @IsString()
  file_key: string

  @IsOptional()
  @IsString()
  commit_message?: string
}
