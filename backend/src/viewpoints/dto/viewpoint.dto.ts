/**
 * 创建视点 DTO
 */
export class CreateViewpointDto {
  /** 视点名称 */
  name: string

  /** 相机位置 */
  camera_position: { x: number; y: number; z: number }

  /** 相机目标点 */
  camera_target: { x: number; y: number; z: number }

  /** 相机上方向（可选） */
  camera_up?: { x: number; y: number; z: number }

  /** 相机视场角（可选） */
  fov?: number
}

/**
 * 更新视点 DTO
 */
export class UpdateViewpointDto {
  /** 视点名称 */
  name?: string

  /** 相机位置 */
  camera_position?: { x: number; y: number; z: number }

  /** 相机目标点 */
  camera_target?: { x: number; y: number; z: number }

  /** 相机上方向 */
  camera_up?: { x: number; y: number; z: number }

  /** 相机视场角 */
  fov?: number
}
