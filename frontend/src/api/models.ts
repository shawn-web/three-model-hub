import axios from 'axios'
import apiClient from './client'

/**
 * 模型相关 API
 */

/** 获取模型列表 */
export async function getModels(params?: { page?: number; limit?: number; search?: string; tag?: string }) {
  const { data } = await apiClient.get('/models', { params })
  return data
}

/** 获取模型详情 */
export async function getModel(id: string) {
  const { data } = await apiClient.get(`/models/${id}`)
  return data
}

/**
 * 上传模型（直传文件服务，获取真实进度）
 * 参考 BaseOrgEdit.vue 的实现：
 *   1. 从后端获取上传配置（URL、token 等）
 *   2. 前端直传文件服务，通过 onUploadProgress 回调真实进度
 *   3. 上传完成后，调后端创建模型记录
 */
export async function uploadModel(
  file: File,
  metadata: { name: string; description?: string; tags?: string[] },
  onProgress?: (percent: number) => void,
) {
  // 1. 获取上传配置（两段路径 /models/upload/config，不与 :id 冲突）
  const { data: config } = await apiClient.get('/models/upload/config')

  // 2. 直传文件服务（不传 bucket，由文件服务自行管理）
  const formData = new FormData()
  formData.append('file', file)
  formData.append('path', config.path)

  // 判断用代理路径还是直连（开发环境用 Vite 代理 /hz-file-upload，避免 CORS）
  const uploadUrl = config.url.replace(/^https?:\/\/[^/]+/, '')
    || config.url

  const uploadResponse = await axios.post(uploadUrl, formData, {
    headers: {
      'token': config.token,
      'clientId': config.clientId,
      'passportId': config.passportId,
    },
    timeout: 600000,
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        // 上传阶段只占 0-90%，留 90-100% 给服务端处理
        onProgress(Math.round((e.loaded / e.total) * 90))
      }
    },
  })

  // 4. 文件上传完成，服务端正在处理
  onProgress?.(95)

  // 5. 解析文件服务返回结果
  const respData = uploadResponse.data
  const inner = respData.data || respData
  const fileUrl = inner.resultUrl || inner.url
  if (!fileUrl) throw new Error('文件上传失败：未获取到文件 URL')
  const fileKey = inner.fileName || inner.fileKey || fileUrl.split('/').pop() || ''

  // 从返回的 URL 中提取 bucket（路径第一段），如 /huazhu/labs/models/... → bucket=huazhu
  let fileBucket = ''
  try {
    const urlPath = new URL(fileUrl).pathname.replace(/^\//, '')
    fileBucket = urlPath.split('/')[0] || ''
  } catch { /* ignore */ }

  // 6. 创建模型记录
  const { data: model } = await apiClient.post('/models/create', {
    name: metadata.name,
    description: metadata.description,
    tags: metadata.tags,
    file_url: fileUrl,
    file_name: file.name,
    file_size: file.size,
    file_bucket: fileBucket,
    file_key: fileKey,
    commit_message: '初始版本',
  })

  onProgress?.(100)
  return model
}

/** 更新模型信息 */
export async function updateModel(id: string, updates: { name?: string; description?: string; tags?: string[] }) {
  const { data } = await apiClient.put(`/models/${id}`, updates)
  return data
}

/** 删除模型 */
export async function deleteModel(id: string) {
  const { data } = await apiClient.delete(`/models/${id}`)
  return data
}

/** 复制模型 */
export async function copyModel(id: string) {
  const { data } = await apiClient.post(`/models/${id}/copy`)
  return data
}

/** 获取模型版本列表 */
export async function getModelVersions(id: string) {
  const { data } = await apiClient.get(`/models/${id}/versions`)
  return data
}

/** 上传新版本 */
export async function uploadVersion(id: string, file: File, commitMessage?: string) {
  const formData = new FormData()
  formData.append('file', file)
  if (commitMessage) formData.append('commit_message', commitMessage)

  const { data } = await apiClient.post(`/models/${id}/versions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
  return data
}

/** 获取下载链接 */
export function getModelDownloadUrl(id: string) {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
  return `${baseUrl}/models/${id}/download`
}

/** 版本对比 */
export async function compareVersions(id: string, v1: string, v2: string) {
  const { data } = await apiClient.get(`/models/${id}/compare`, { params: { v1, v2 } })
  return data
}
