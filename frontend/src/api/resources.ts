import apiClient, { invalidateHttpCache } from './client'
import type { ResourceType, ResourceItem, ResourceGroup } from '../types/resource'

// ===== 资源接口 =====

/** 获取资源列表 */
export async function getResources(params?: {
  page?: number
  limit?: number
  type?: ResourceType
  group_id?: string
  search?: string
}) {
  const { data } = await apiClient.get('/resources', { params })
  return data as { items: ResourceItem[]; total: number; page: number; limit: number }
}

/** 上传并创建资源 */
export async function uploadResource(
  file: File,
  metadata: {
    name: string
    type: ResourceType
    group_id?: string
    width?: number
    height?: number
    duration?: number
    mime_type?: string
  },
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', metadata.name)
  formData.append('type', metadata.type)
  if (metadata.group_id) formData.append('group_id', metadata.group_id)
  if (metadata.width) formData.append('width', String(metadata.width))
  if (metadata.height) formData.append('height', String(metadata.height))
  if (metadata.duration) formData.append('duration', String(metadata.duration))
  if (metadata.mime_type) formData.append('mime_type', metadata.mime_type)

  const { data } = await apiClient.post('/resources/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
  invalidateHttpCache('/resources')
  return data as ResourceItem
}

/** 更新资源 */
export async function updateResource(id: string, dto: { name?: string; group_id?: string }) {
  const { data } = await apiClient.patch(`/resources/${id}`, dto)
  invalidateHttpCache('/resources')
  return data as ResourceItem
}

/** 删除资源 */
export async function deleteResource(id: string) {
  const { data } = await apiClient.delete(`/resources/${id}`)
  invalidateHttpCache('/resources')
  return data
}

// ===== 分组接口 =====

/** 获取分组列表 */
export async function getResourceGroups() {
  const { data } = await apiClient.get('/resources/groups')
  return data as ResourceGroup[]
}

/** 创建分组 */
export async function createResourceGroup(dto: { name: string; sort_order?: number }) {
  const { data } = await apiClient.post('/resources/groups', dto)
  invalidateHttpCache('/resources')
  return data as ResourceGroup
}

/** 更新分组 */
export async function updateResourceGroup(id: string, dto: { name?: string; sort_order?: number }) {
  const { data } = await apiClient.patch(`/resources/groups/${id}`, dto)
  invalidateHttpCache('/resources')
  return data as ResourceGroup
}

/** 删除分组 */
export async function deleteResourceGroup(id: string) {
  const { data } = await apiClient.delete(`/resources/groups/${id}`)
  invalidateHttpCache('/resources')
  return data
}

// ===== 工具函数 =====

/** 读取图片元数据（宽高） */
export function readImageMeta(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('无法读取图片信息'))
    }
    img.src = URL.createObjectURL(file)
  })
}

/** 读取视频元数据（宽高、时长） */
export function readVideoMeta(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Math.round(video.duration * 100) / 100,
      })
      URL.revokeObjectURL(video.src)
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('无法读取视频信息'))
    }
    video.src = URL.createObjectURL(file)
  })
}
