import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator'

/**
 * 触发模型压缩请求体
 *
 * - versionId 默认压缩最新版本
 * - compressTexture 默认 true（PNG/JPEG → WebP）
 * - algorithm 当前仅支持 meshopt，字段先留着，将来 draco 启用时直接复用
 */
export class CreateCompressionDto {
  @IsOptional()
  @IsUUID()
  versionId?: string

  @IsOptional()
  @IsBoolean()
  compressTexture?: boolean

  @IsOptional()
  @IsString()
  algorithm?: 'meshopt'
}
