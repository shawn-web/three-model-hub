import { IsString, IsNotEmpty, IsArray, IsInt, Min, Max, ValidateNested, ArrayMinSize } from 'class-validator'
import { Type } from 'class-transformer'

/** 单个分片信息 */
export class PartInfo {
  @IsInt({ message: 'partNumber 必须为整数' })
  @Min(1, { message: 'partNumber 必须 >= 1' })
  @Max(10000, { message: 'partNumber 不能超过 10000' })
  partNumber: number

  @IsString()
  @IsNotEmpty({ message: 'etag 不能为空' })
  etag: string
}

/**
 * 合并分片 DTO
 */
export class CompleteMultipartDto {
  @IsString()
  @IsNotEmpty({ message: 'uploadId 不能为空' })
  uploadId: string

  @IsArray()
  @ArrayMinSize(1, { message: 'parts 至少包含 1 个分片' })
  @ValidateNested({ each: true })
  @Type(() => PartInfo)
  parts: PartInfo[]
}
