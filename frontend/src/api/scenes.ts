import apiClient from './client'

/**
 * 场景相关 API
 */

/** 获取场景列表 */
export async function getScenes(params?: { page?: number; limit?: number; search?: string }) {
  const { data } = await apiClient.get('/scenes', { params })
  return data
}

/** 获取场景详情 */
export async function getScene(id: string) {
  const { data } = await apiClient.get(`/scenes/${id}`)
  return data
}

/** 获取场景完整数据（用于预览） */
export async function getSceneData(id: string) {
  const { data } = await apiClient.get(`/scenes/${id}/data`)
  return data
}

/** 创建场景 */
export async function createScene(dto: { name: string; description?: string; scene_config?: Record<string, any> }) {
  const { data } = await apiClient.post('/scenes', dto)
  return data
}

/** 更新场景 */
export async function updateScene(id: string, dto: { name?: string; description?: string; thumbnail_url?: string; scene_config?: Record<string, any> }) {
  const { data } = await apiClient.put(`/scenes/${id}`, dto)
  return data
}

/** 删除场景 */
export async function deleteScene(id: string) {
  const { data } = await apiClient.delete(`/scenes/${id}`)
  return data
}

/** 添加模型到场景 */
export async function addModelToScene(sceneId: string, dto: {
  model_id: string
  model_version_id?: string
  transform?: Record<string, any>
  display_name?: string
}) {
  const { data } = await apiClient.post(`/scenes/${sceneId}/models`, dto)
  return data
}

/** 更新场景中的模型 */
export async function updateSceneModel(sceneId: string, sceneModelId: string, dto: {
  transform?: Record<string, any>
  material_overrides?: Record<string, any>
  visible?: boolean
  display_name?: string
}) {
  const { data } = await apiClient.put(`/scenes/${sceneId}/models/${sceneModelId}`, dto)
  return data
}

/** 从场景中移除模型 */
export async function removeSceneModel(sceneId: string, sceneModelId: string) {
  const { data } = await apiClient.delete(`/scenes/${sceneId}/models/${sceneModelId}`)
  return data
}

/** 批量更新场景模型 */
export async function batchUpdateSceneModels(
  sceneId: string,
  models: Array<{
    id: string
    transform?: Record<string, any>
    material_overrides?: Record<string, any>
    visible?: boolean
    display_name?: string
  }>,
) {
  const { data } = await apiClient.put(`/scenes/${sceneId}/models/batch`, { models })
  return data
}
