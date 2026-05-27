import { IsString, IsOptional, IsNumber } from 'class-validator'

/**
 * 创建批注 DTO
 */
export class CreateAnnotationDto {
  /** 批注在 3D 空间中的位置 */
  @IsNumber()
  x: number

  @IsNumber()
  y: number

  @IsNumber()
  z: number

  /** 批注文本内容 */
  @IsString()
  text: string

  /** 批注作者（可选） */
  @IsOptional()
  @IsString()
  author?: string
}

/**
 * 更新批注 DTO
 */
export class UpdateAnnotationDto {
  /** 批注在 3D 空间中的位置 */
  @IsOptional()
  @IsNumber()
  x?: number

  @IsOptional()
  @IsNumber()
  y?: number

  @IsOptional()
  @IsNumber()
  z?: number

  /** 批注文本内容 */
  @IsOptional()
  @IsString()
  text?: string

  /** 批注作者 */
  @IsOptional()
  @IsString()
  author?: string
}
