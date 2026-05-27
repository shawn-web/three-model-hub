import { IsString, IsOptional, IsArray, IsNumber, Min } from 'class-validator'

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
 * 前端直传后创建模型 DTO
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

  @IsString()
  file_url: string

  @IsString()
  file_name: string

  @IsNumber()
  @Min(0)
  file_size: number

  @IsString()
  file_key: string

  @IsOptional()
  @IsString()
  commit_message?: string
}
