import apiClient from './client'
import { message } from 'antd'
import type {
  UploadOptions,
  UploadResult,
  InitMultipartResponse,
  UploadPartResponse,
  CompleteMultipartResponse,
  UploadStatusResponse,
} from '../types/upload'
import {
  CHUNK_SIZE,
  CHUNK_THRESHOLD,
  MAX_CONCURRENT_PARTS,
  MAX_PART_RETRY,
  MAX_UPLOAD_SIZE_BYTES,
} from '../types/upload'

/**
 * 上传管理 API（tapp → MinIO 迁移后的统一入口）
 *
 * 用法：
 *   const { url, fileKey, fileSize } = await uploadFile(file, {
 *     bizType: 'model',
 *     onProgress: (p) => setUploadPercent(p),
 *   })
 *
 * 内部按 file.size 自动选路径：
 *   - < 8MB 走 simple（POST /upload/simple multipart）
 *   - ≥ 8MB 走 chunked（POST /upload/multipart/{init,part,complete}）
 *
 * chunked 支持：
 *   - 8MB 分片 + 3 路并发
 *   - 每个分片 3 次重试（指数退避）
 *   - 断点续传：调 /status 拿已上传分片，跳过已成功部分
 *   - AbortSignal：上传中可取消
 *
 * 大小校验：
 *   - 在文件读取前先做 size 校验，超过 MAX_UPLOAD_SIZE_BYTES 立即拒绝
 *   - 防止 413 Payload Too Large 浪费网络
 */

/**
 * 主入口：自动选择 simple 或 chunked
 */
export async function uploadFile(
  file: File,
  options: UploadOptions,
): Promise<UploadResult> {
  // 1. 大小校验
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const mb = Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)
    message.error(`文件超过 ${mb}MB 上限`)
    throw new Error(`File too large: ${file.size} > ${MAX_UPLOAD_SIZE_BYTES}`)
  }

  if (file.size < CHUNK_THRESHOLD) {
    return uploadFileSimple(file, options)
  }
  return uploadFileByChunk(file, options)
}

/**
 * 简单上传（< 8MB 整文件单次）
 */
async function uploadFileSimple(
  file: File,
  options: UploadOptions,
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('bizType', options.bizType)

  const { data } = await apiClient.post<UploadResult>('/upload/simple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
    signal: options.signal,
    onUploadProgress: (e) => {
      if (e.total && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 95))
      }
    },
  })

  options.onProgress?.(100)
  return data
}

/**
 * 分片上传（≥ 8MB）
 * 流程：init → N 次 part → complete
 */
async function uploadFileByChunk(
  file: File,
  options: UploadOptions,
): Promise<UploadResult> {
  // 1. 初始化
  const { data: init } = await apiClient.post<InitMultipartResponse>(
    '/upload/multipart/init',
    {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      bizType: options.bizType,
    },
    { signal: options.signal },
  )

  // 2. 断点续传：查询已上传分片
  const uploaded = new Set<number>()
  try {
    const { data: status } = await apiClient.get<UploadStatusResponse>(
      '/upload/multipart/status',
      { params: { uploadId: init.uploadId }, signal: options.signal },
    )
    for (const partNumber of status.uploadedParts) {
      uploaded.add(partNumber)
    }
  } catch {
    // 续传查询失败不影响首次上传
  }

  // 3. 构建待上传分片队列
  const queue: number[] = []
  for (let i = 1; i <= init.totalParts; i++) {
    if (!uploaded.has(i)) queue.push(i)
  }

  // 4. 累计已上传字节数（用于进度回调）
  const partSize = init.partSize || CHUNK_SIZE
  let uploadedBytes = uploaded.size * partSize
  // 修正最后一个分片大小
  if (uploaded.has(init.totalParts)) {
    uploadedBytes -= partSize
    uploadedBytes += file.size - (init.totalParts - 1) * partSize
  }

  const updateProgress = () => {
    const pct = Math.min(95, Math.round((uploadedBytes / file.size) * 95))
    options.onProgress?.(pct)
  }

  // 5. 并发上传分片
  const etagMap = new Map<number, string>()
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_PARTS, queue.length) },
    () => worker(),
  )

  async function worker() {
    while (queue.length > 0) {
      if (options.signal?.aborted) {
        throw new DOMException('Upload aborted', 'AbortError')
      }

      const partNumber = queue.shift()!
      const start = (partNumber - 1) * partSize
      const end = Math.min(start + partSize, file.size)
      const blob = file.slice(start, end)

      const etag = await uploadPartWithRetry(init.uploadId, partNumber, blob, options.signal)
      etagMap.set(partNumber, etag)
      uploadedBytes += blob.size
      updateProgress()
    }
  }

  await Promise.all(workers)

  // 6. 合并
  const parts = Array.from(etagMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([partNumber, etag]) => ({ partNumber, etag }))

  const { data: result } = await apiClient.post<CompleteMultipartResponse>(
    '/upload/multipart/complete',
    { uploadId: init.uploadId, parts },
    { signal: options.signal },
  )

  options.onProgress?.(100)
  return result
}

/**
 * 单分片上传（含重试）
 *
 * 使用 multipart/form-data 封装分片字节（NestJS FileInterceptor 接收）
 */
async function uploadPartWithRetry(
  uploadId: string,
  partNumber: number,
  blob: Blob,
  signal?: AbortSignal,
): Promise<string> {
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_PART_RETRY; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError')
    }

    try {
      const formData = new FormData()
      formData.append('file', blob)

      const { data: partResp } = await apiClient.post<UploadPartResponse>(
        `/upload/multipart/part?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
        formData,
        {
          // 让 axios 自动设置 multipart/form-data boundary
          signal,
        },
      )

      if (!partResp.etag) {
        throw new Error(`分片 ${partNumber} 响应缺少 etag`)
      }
      return partResp.etag
    } catch (err) {
      lastError = err
      if (signal?.aborted) {
        throw new DOMException('Upload aborted', 'AbortError')
      }
      // 指数退避：500ms、1s、2s
      const delay = 500 * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw new Error(
    `分片 ${partNumber} 上传失败（已重试 ${MAX_PART_RETRY} 次）: ${String(lastError)}`,
  )
}

/**
 * 主动取消上传
 */
export async function abortUpload(uploadId: string): Promise<void> {
  try {
    await apiClient.post('/upload/multipart/abort', { uploadId })
  } catch {
    // 幂等：忽略错误
  }
}
