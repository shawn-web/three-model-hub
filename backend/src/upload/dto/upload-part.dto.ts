import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator'
import { Transform } from 'class-transformer'

/** 单分片最大 9MB（8MB chunk + 1MB 余量，避免正好 8MB 被 multer 严格 > 拒绝） */
export const MAX_PART_SIZE_BYTES = 9 * 1024 * 1024

/**
 * 上传分片 query 参数 DTO
 *
 * 业务流程：每个分片对应一次 HTTP 请求，body 是原始字节
 */
export class UploadPartQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'uploadId 不能为空' })
  uploadId: string

  @IsInt({ message: 'partNumber 必须为整数' })
  @Min(1, { message: 'partNumber 必须 >= 1' })
  @Max(10000, { message: 'partNumber 不能超过 10000' })
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  partNumber: number
}
