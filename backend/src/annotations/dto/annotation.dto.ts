/**
 * 创建批注 DTO
 */
export class CreateAnnotationDto {
  /** 批注在 3D 空间中的位置 */
  position: { x: number; y: number; z: number }

  /** 批注文本内容 */
  text: string

  /** 批注作者（可选） */
  author?: string
}

/**
 * 更新批注 DTO
 */
export class UpdateAnnotationDto {
  /** 批注在 3D 空间中的位置 */
  position?: { x: number; y: number; z: number }

  /** 批注文本内容 */
  text?: string

  /** 批注作者 */
  author?: string
}
