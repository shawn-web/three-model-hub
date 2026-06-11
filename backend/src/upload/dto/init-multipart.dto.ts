import { IsString, IsNotEmpty, IsNumber, IsIn, Max, Min } from 'class-validator'

/** 业务类型枚举（与 plan 一致） */
export const BIZ_TYPES = [
  'model',
  'model-version',
  'resource-image',
  'resource-video',
  'marker-icon',
  'thumbnail',
] as const

export type BizType = (typeof BIZ_TYPES)[number]

/** 全局文件大小上限（MB → 字节） */
const MAX_UPLOAD_SIZE_BYTES =
  parseInt(process.env.MAX_UPLOAD_SIZE_MB || '1024', 10) * 1024 * 1024

/**
 * 初始化分片上传 DTO
 *
 * 业务流程：
 *   1. 前端拿到文件后先调 /upload/multipart/init 拿到 uploadId
 *   2. 再循环调 /upload/multipart/part 上传每个 8MB 分片
 *   3. 最后调 /upload/multipart/complete 合并
 *
 * 字段命名与前端保持 camelCase 一致（NestJS 默认不会自动转换）
 */
export class InitMultipartDto {
  @IsString()
  @IsNotEmpty({ message: '文件名不能为空' })
  fileName: string

  @IsNumber()
  @Min(1, { message: '文件大小必须大于 0' })
  @Max(MAX_UPLOAD_SIZE_BYTES, {
    message: `文件大小不能超过 ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB`,
  })
  fileSize: number

  @IsString()
  @IsNotEmpty({ message: 'MIME 类型不能为空' })
  mimeType: string

  @IsString()
  @IsIn(BIZ_TYPES, { message: `bizType 必须是 ${BIZ_TYPES.join(', ')} 之一` })
  bizType: BizType
}