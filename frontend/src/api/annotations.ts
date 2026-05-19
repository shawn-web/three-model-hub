import apiClient from './client'

/**
 * 批注相关 API
 */

/** 批注数据类型 */
export interface AnnotationData {
  id: string
  scene_id: string
  position: { x: number; y: number; z: number }
  text: string
  author?: string
  created_at: string
}

/** 创建批注参数 */
export interface CreateAnnotationParams {
  position: { x: number; y: number; z: number }
  text: string
  author?: string
}

/** 获取场景的所有批注 */
export async function getAnnotations(sceneId: string): Promise<AnnotationData[]> {
  const { data } = await apiClient.get(`/scenes/${sceneId}/annotations`)
  return data
}

/** 获取单条批注详情 */
export async function getAnnotation(sceneId: string, id: string): Promise<AnnotationData> {
  const { data } = await apiClient.get(`/scenes/${sceneId}/annotations/${id}`)
  return data
}

/** 创建批注 */
export async function createAnnotation(sceneId: string, params: CreateAnnotationParams): Promise<AnnotationData> {
  const { data } = await apiClient.post(`/scenes/${sceneId}/annotations`, params)
  return data
}

/** 更新批注 */
export async function updateAnnotation(sceneId: string, id: string, params: Partial<CreateAnnotationParams>): Promise<AnnotationData> {
  const { data } = await apiClient.patch(`/scenes/${sceneId}/annotations/${id}`, params)
  return data
}

/** 删除批注 */
export async function deleteAnnotation(sceneId: string, id: string): Promise<void> {
  await apiClient.delete(`/scenes/${sceneId}/annotations/${id}`)
}
