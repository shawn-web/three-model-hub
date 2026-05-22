import { ResourceType } from '../entities/resource.entity'

/** 创建资源 DTO */
export class CreateResourceDto {
  name: string
  type: ResourceType
  url: string
  file_size?: number
  mime_type?: string
  width?: number
  height?: number
  duration?: number
  thumbnail_url?: string
  group_id?: string
  file_key?: string
}

/** 更新资源 DTO */
export class UpdateResourceDto {
  name?: string
  group_id?: string
}

/** 创建资源分组 DTO */
export class CreateResourceGroupDto {
  name: string
  sort_order?: number
}

/** 更新资源分组 DTO */
export class UpdateResourceGroupDto {
  name?: string
  sort_order?: number
}
