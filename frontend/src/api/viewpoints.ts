import apiClient from './client'

/**
 * 视点相关 API
 */

/** 视点数据类型 */
export interface ViewpointData {
  id: string
  scene_id: string
  name: string
  camera_position: { x: number; y: number; z: number }
  camera_target: { x: number; y: number; z: number }
  camera_up?: { x: number; y: number; z: number }
  fov?: number
  created_at: string
}

/** 创建视点参数 */
export interface CreateViewpointParams {
  name: string
  camera_position: { x: number; y: number; z: number }
  camera_target: { x: number; y: number; z: number }
  camera_up?: { x: number; y: number; z: number }
  fov?: number
}

/** 获取场景的所有视点 */
export async function getViewpoints(sceneId: string): Promise<ViewpointData[]> {
  const { data } = await apiClient.get(`/scenes/${sceneId}/viewpoints`)
  return data
}

/** 获取单个视点详情 */
export async function getViewpoint(sceneId: string, id: string): Promise<ViewpointData> {
  const { data } = await apiClient.get(`/scenes/${sceneId}/viewpoints/${id}`)
  return data
}

/** 创建视点 */
export async function createViewpoint(sceneId: string, params: CreateViewpointParams): Promise<ViewpointData> {
  const { data } = await apiClient.post(`/scenes/${sceneId}/viewpoints`, params)
  return data
}

/** 更新视点 */
export async function updateViewpoint(sceneId: string, id: string, params: Partial<CreateViewpointParams>): Promise<ViewpointData> {
  const { data } = await apiClient.patch(`/scenes/${sceneId}/viewpoints/${id}`, params)
  return data
}

/** 删除视点 */
export async function deleteViewpoint(sceneId: string, id: string): Promise<void> {
  await apiClient.delete(`/scenes/${sceneId}/viewpoints/${id}`)
}
