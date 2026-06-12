import { IsString, IsNotEmpty } from 'class-validator'

/**
 * 取消分片上传 DTO
 */
export class AbortDto {
  @IsString()
  @IsNotEmpty({ message: 'uploadId 不能为空' })
  uploadId: string
}
