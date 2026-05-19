/**
 * 创建模型 DTO
 */
export class CreateModelDto {
  name: string
  description?: string
  tags?: string[]
  commit_message?: string
}

/**
 * 更新模型 DTO
 */
export class UpdateModelDto {
  name?: string
  description?: string
  tags?: string[]
  thumbnail_url?: string
  is_public?: boolean
}

/**
 * 上传新版本 DTO
 */
export class CreateVersionDto {
  commit_message?: string
}

/**
 * 前端直传后创建模型 DTO
 * 前端直接上传文件到文件服务后，用此 DTO 创建模型记录
 */
export class CreateFromUrlDto {
  name: string
  description?: string
  tags?: string[]
  file_url: string
  file_name: string
  file_size: number
  file_bucket: string
  file_key: string
  commit_message?: string
}
