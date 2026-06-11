import { IsOptional, IsNumber, Min, Max } from 'class-validator'

/**
 * 地理定位验证 DTO（WGS84 坐标）
 * 用于验证 geo_position JSON 字段的内部结构
 */
export class GeoPositionDto {
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number

  @IsNumber()
  altitude!: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  pitch?: number

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  roll?: number

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  scale?: number
}
