import apiClient, { invalidateHttpCache } from './client'
import { uploadFile } from './upload'
import type { UploadResult } from '../types/upload'

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
 * 上传模型（tapp → MinIO 迁移后）
 *
 * 流程：
 *   1. uploadFile 调 /upload/multipart/* 或 /upload/simple 完成 MinIO 上传
 *   2. 拿到 { url, fileKey, fileSize } 后 POST /models/create 落库
 *
 * 进度：0-95% 走 uploadFile 的 onProgress，100% 在数据库落库后回调
 */
export async function uploadModel(
  file: File,
  metadata: { name: string; description?: string; tags?: string[] },
  onProgress?: (percent: number) => void,
) {
  const { url, fileKey, fileSize }: UploadResult = await uploadFile(file, {
    bizType: 'model',
    onProgress,
  })

  const { data: model } = await apiClient.post('/models/create', {
    name: metadata.name,
    description: metadata.description,
    tags: metadata.tags,
    file_url: url,
    file_name: file.name,
    file_size: fileSize,
    file_key: fileKey,
    commit_message: '初始版本',
  })

  onProgress?.(100)
  invalidateHttpCache('/models')
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
  invalidateHttpCache('/models')
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

/**
 * 上传新版本
 * 流程：uploadFile → POST /models/:id/versions 带 fileKey
 */
export async function uploadVersion(
  id: string,
  file: File,
  commitMessage?: string,
  onProgress?: (percent: number) => void,
) {
  const { url, fileKey, fileSize }: UploadResult = await uploadFile(file, {
    bizType: 'model-version',
    onProgress,
  })

  const { data } = await apiClient.post(`/models/${id}/versions`, {
    file_url: url,
    file_key: fileKey,
    file_size: fileSize,
    file_name: file.name,
    commit_message: commitMessage,
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
