import apiClient, { invalidateHttpCache } from './client'

/**
 * 地理地图相关 API
 */

/** 通用 JSON 配置类型 */
type JsonConfig = Record<string, unknown>

/** 获取地图列表 */
export async function getGeoMaps(params?: { page?: number; limit?: number; search?: string }) {
  const { data } = await apiClient.get('/geo-maps', { params })
  return data
}

/** 获取地图详情 */
export async function getGeoMap(id: string) {
  const { data } = await apiClient.get(`/geo-maps/${id}`)
  return data
}

/** 获取地图完整数据（用于前端渲染） */
export async function getGeoMapData(id: string) {
  const { data } = await apiClient.get(`/geo-maps/${id}/data`)
  return data
}

/** 创建地图 */
export async function createGeoMap(dto: { name: string; description?: string; config?: JsonConfig }) {
  const { data } = await apiClient.post('/geo-maps', dto)
  return data
}

/** 更新地图 */
export async function updateGeoMap(id: string, dto: { name?: string; description?: string; thumbnail_url?: string; config?: JsonConfig }) {
  const { data } = await apiClient.put(`/geo-maps/${id}`, dto)
  invalidateHttpCache(`/geo-maps/${id}/data`)
  return data
}

/** 删除地图 */
export async function deleteGeoMap(id: string) {
  const { data } = await apiClient.delete(`/geo-maps/${id}`)
  return data
}

/** 添加模型到地图 */
export async function addModelToGeoMap(geoMapId: string, dto: {
  model_id: string
  model_version_id?: string
  display_name?: string
  geo_position?: JsonConfig
}) {
  const { data } = await apiClient.post(`/geo-maps/${geoMapId}/models`, dto)
  return data
}

/** 更新地图中的模型 */
export async function updateGeoMapModel(geoMapId: string, modelId: string, dto: {
  display_name?: string
  geo_position?: JsonConfig | null
  visible?: boolean
}) {
  const { data } = await apiClient.put(`/geo-maps/${geoMapId}/models/${modelId}`, dto)
  return data
}

/** 从地图中移除模型 */
export async function removeGeoMapModel(geoMapId: string, modelId: string) {
  const { data } = await apiClient.delete(`/geo-maps/${geoMapId}/models/${modelId}`)
  return data
}

/** 统一保存 Geo 配置（原子操作：同时保存模型坐标 + 底图配置） */
export async function saveGeoConfig(
  geoMapId: string,
  dto: {
    models: Array<{
      id: string
      display_name?: string
      geo_position?: JsonConfig | null
      visible?: boolean
    }>
    geoConfig?: JsonConfig
  },
) {
  const { data } = await apiClient.put(`/geo-maps/${geoMapId}/geo`, dto)
  invalidateHttpCache(`/geo-maps/${geoMapId}/data`)
  return data
}

/** 批量更新地图模型 */
export async function batchUpdateGeoMapModels(
  geoMapId: string,
  models: Array<{
    id: string
    display_name?: string
    geo_position?: JsonConfig | null
    visible?: boolean
  }>,
) {
  const { data } = await apiClient.put(`/geo-maps/${geoMapId}/models/batch`, { models })
  invalidateHttpCache(`/geo-maps/${geoMapId}/data`)
  return data
}
