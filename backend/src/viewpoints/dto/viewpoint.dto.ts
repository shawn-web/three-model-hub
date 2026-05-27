import { IsString, IsOptional, IsNumber } from 'class-validator'

/**
 * 创建视点 DTO
 */
export class CreateViewpointDto {
  /** 视点名称 */
  @IsString()
  name: string

  /** 相机位置 */
  @IsNumber()
  camera_position_x: number

  @IsNumber()
  camera_position_y: number

  @IsNumber()
  camera_position_z: number

  /** 相机目标点 */
  @IsNumber()
  camera_target_x: number

  @IsNumber()
  camera_target_y: number

  @IsNumber()
  camera_target_z: number

  /** 相机上方向（可选） */
  @IsOptional()
  @IsNumber()
  camera_up_x?: number

  @IsOptional()
  @IsNumber()
  camera_up_y?: number

  @IsOptional()
  @IsNumber()
  camera_up_z?: number

  /** 相机视场角（可选） */
  @IsOptional()
  @IsNumber()
  fov?: number
}

/**
 * 更新视点 DTO
 */
export class UpdateViewpointDto {
  /** 视点名称 */
  @IsOptional()
  @IsString()
  name?: string

  /** 相机位置 */
  @IsOptional()
  @IsNumber()
  camera_position_x?: number

  @IsOptional()
  @IsNumber()
  camera_position_y?: number

  @IsOptional()
  @IsNumber()
  camera_position_z?: number

  /** 相机目标点 */
  @IsOptional()
  @IsNumber()
  camera_target_x?: number

  @IsOptional()
  @IsNumber()
  camera_target_y?: number

  @IsOptional()
  @IsNumber()
  camera_target_z?: number

  /** 相机上方向 */
  @IsOptional()
  @IsNumber()
  camera_up_x?: number

  @IsOptional()
  @IsNumber()
  camera_up_y?: number

  @IsOptional()
  @IsNumber()
  camera_up_z?: number

  /** 相机视场角 */
  @IsOptional()
  @IsNumber()
  fov?: number
}
