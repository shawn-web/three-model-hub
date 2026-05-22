/** 资源类型 */
export type ResourceType = 'image' | 'video'

/** 资源项 */
export interface ResourceItem {
  id: string
  name: string
  type: ResourceType
  url: string
  file_size: number
  mime_type?: string
  width?: number
  height?: number
  duration?: number
  thumbnail_url?: string
  group_id?: string
  created_at: string
  updated_at: string
}

/** 资源分组 */
export interface ResourceGroup {
  id: string
  name: string
  sort_order: number
  created_at: string
}
