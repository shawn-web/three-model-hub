import apiClient, { invalidateHttpCache } from './client'
import { uploadFile } from './upload'
import { downloadFileByChunk } from './download'
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

/** 上传模型的返回值：后端在落库 model 之上附带 compressionTaskId（若勾选压缩） */
export interface UploadModelResult {
  [key: string]: unknown
  /** 若上传时 compress=true 且后端成功触发压缩，返回压缩任务 id，用于轮询进度 */
  compressionTaskId?: string
}

/**
 * 上传模型（MinIO 分片上传 → 落库）
 *
 * 流程：
 *   1. uploadFile 调 /upload/multipart/* 或 /upload/simple 完成 MinIO 上传
 *   2. 拿到 { url, fileKey, fileSize } 后 POST /models/create 落库
 *   3. 若 compress=true，后端落库后自动触发异步压缩，返回 compressionTaskId
 *
 * 进度：0-95% 走 uploadFile 的 onProgress，100% 在数据库落库后回调
 *
 * @param compress 是否在上传后触发模型压缩（前端在上传对话框让用户选择）
 */
export async function uploadModel(
  file: File,
  metadata: { name: string; description?: string; tags?: string[] },
  onProgress?: (percent: number) => void,
  compress?: boolean,
): Promise<UploadModelResult> {
  const { url, fileKey, fileSize }: UploadResult = await uploadFile(file, {
    bizType: 'model',
    onProgress,
  })

  const { data: model } = await apiClient.post<UploadModelResult>('/models/create', {
    name: metadata.name,
    description: metadata.description,
    tags: metadata.tags,
    file_url: url,
    file_name: file.name,
    file_size: fileSize,
    file_key: fileKey,
    commit_message: '初始版本',
    compress: compress ?? false,
  })

  onProgress?.(100)
  invalidateHttpCache('/models')
  return model
}

/** 更新模型信息 */
export async function updateModel(id: string, updates: { name?: string; description?: string; tags?: string[] }) {
  const { data } = await apiClient.put(`/models/${id}`, updates)
  invalidateHttpCache('/models')
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
  invalidateHttpCache('/models')
  return data
}

/** 获取模型版本列表 */
export async function getModelVersions(id: string) {
  const { data } = await apiClient.get(`/models/${id}/versions`)
  return data
}

/** 上传新版本的返回值：后端在落库 version 之上附带 compressionTaskId */
export interface UploadVersionResult {
  [key: string]: unknown
  compressionTaskId?: string
}

/**
 * 上传新版本
 * 流程：uploadFile → POST /models/:id/versions 带 fileKey
 *
 * @param compress 是否在上传后触发该版本压缩
 */
export async function uploadVersion(
  id: string,
  file: File,
  commitMessage?: string,
  onProgress?: (percent: number) => void,
  compress?: boolean,
): Promise<UploadVersionResult> {
  const { url, fileKey, fileSize }: UploadResult = await uploadFile(file, {
    bizType: 'model-version',
    onProgress,
  })

  const { data } = await apiClient.post<UploadVersionResult>(`/models/${id}/versions`, {
    file_url: url,
    file_key: fileKey,
    file_size: fileSize,
    file_name: file.name,
    commit_message: commitMessage,
    compress: compress ?? false,
  })
  invalidateHttpCache(`/models/${id}/versions`)
  invalidateHttpCache(`/models/${id}`)
  return data
}

/** 获取下载链接 */
export function getModelDownloadUrl(id: string) {
  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  return `${baseUrl}/models/${id}/download`
}

/**
 * 分片并发下载模型（带进度回调）
 *
 * 流程：
 *   1. 拉一次 /models/:id 拿到 file_url + file_name
 *   2. 用通用的分片下载工具走 Range 并发拉字节（< 32MB 自动回退单次）
 *   3. 浏览器 <a download> 触发实际保存
 *
 * 进度：loaded/total 字节数，调用方自行换算百分比
 *
 * 与 getModelDownloadUrl（直接 302 重定向）的区别：
 *   - 本函数支持进度回调、取消、大文件并发下载
 *   - getModelDownloadUrl 是简单链入场景（如 iframe src、复制链接）
 */
export async function downloadModelWithProgress(
  id: string,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const model = await getModel(id)
  if (!model.file_url) {
    throw new Error('模型文件不可用')
  }
  const fileName =
    model.file_name || `${model.name}.${model.file_format || 'glb'}`
  await downloadFileByChunk(model.file_url, fileName, {
    onProgress: onProgress
      ? (p) => onProgress(p.loaded, p.total)
      : undefined,
    signal,
  })
}

/** 压缩任务快照（与后端 CompressionTask 对齐） */
export interface CompressionTask {
  taskId: string
  modelId: string
  versionId: string
  algorithm: 'meshopt'
  compressTexture: boolean
  status: 'queued' | 'downloading' | 'compressing' | 'uploading' | 'completed' | 'failed'
  stage: string | null
  percentage: number
  originalSize?: number
  compressedSize?: number
  compressionRatio?: number
  newVersionId?: string
  errorMessage?: string
}

/** 查询压缩任务状态（前端轮询用） */
export async function getCompressionTask(taskId: string): Promise<CompressionTask> {
  const { data } = await apiClient.get(`/models/compression-tasks/${taskId}`)
  return data
}
/** 版本对比 */
export async function compareVersions(id: string, v1: string, v2: string) {
  const { data } = await apiClient.get(`/models/${id}/compare`, { params: { v1, v2 } })
  return data
}