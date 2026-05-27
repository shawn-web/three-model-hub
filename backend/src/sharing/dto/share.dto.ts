import { IsOptional, IsString, IsNumber, Min, IsIn } from 'class-validator'

/**
 * 创建分享链接 DTO
 */
export class CreateShareLinkDto {
  @IsOptional()
  @IsString()
  scene_id?: string

  @IsOptional()
  @IsString()
  model_id?: string

  @IsOptional()
  @IsIn(['view', 'download'])
  permission?: 'view' | 'download'

  @IsOptional()
  @IsNumber()
  @Min(1)
  expires_hours?: number
}
