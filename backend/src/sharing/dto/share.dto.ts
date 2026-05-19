/**
 * 创建分享链接 DTO
 */
export class CreateShareLinkDto {
  scene_id?: string
  model_id?: string
  permission?: 'view' | 'download'
  expires_hours?: number  // 过期小时数，null 表示永不过期
}
