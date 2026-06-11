/**
 * 文件上传相关类型
 *
 * 重构：tapp → MinIO 迁移后，前端通过后端代理上传（不再直传 tapp）。
 * 单一入口：uploadFile(file, options)，按文件大小自动选 simple 或 chunked 路径。
 */

/** 业务类型（与后端 backend/src/upload/dto/init-multipart.dto.ts BIZ_TYPES 一致） */
export type BizType =
  | 'model'
  | 'model-version'
  | 'resource-image'
  | 'resource-video'
  | 'marker-icon'
  | 'thumbnail'

/** 上传选项 */
export interface UploadOptions {
  /** 业务类型，决定 MinIO objectKey 前缀 */
  bizType: BizType
  /** 进度回调，0-100 */
  onProgress?: (percent: number) => void
  /** 取消信号 */
  signal?: AbortSignal
}

/** 上传结果 */
export interface UploadResult {
  /** MinIO 公开访问 URL */
  url: string
  /** MinIO objectKey（用于后续业务接口携带） */
  fileKey: string
  /** 文件大小（字节） */
  fileSize: number
}

/** 分片上传初始化响应 */
export interface InitMultipartResponse {
  uploadId: string
  objectKey: string
  partSize: number
  totalParts: number
}

/** 单分片上传响应 */
export interface UploadPartResponse {
  etag: string
  partNumber: number
}

/** 合并分片响应 */
export interface CompleteMultipartResponse {
  url: string
  fileKey: string
  fileSize: number
}

/** 上传状态查询响应（断点续传） */
export interface UploadStatusResponse {
  objectKey: string
  fileSize: number
  uploadedParts: number[]
}

/** 分片大小：8MB（与后端 CHUNK_SIZE 对齐） */
export const CHUNK_SIZE = 8 * 1024 * 1024

/** 文件大小阈值：≥ 8MB 自动启用分片 */
export const CHUNK_THRESHOLD = CHUNK_SIZE

/** 最大并发分片数 */
export const MAX_CONCURRENT_PARTS = 3

/** 单分片最大重试次数 */
export const MAX_PART_RETRY = 3

/**
 * 文件大小上限（MB → 字节）
 * 默认 1GB，可通过 VITE_MAX_UPLOAD_SIZE_MB 环境变量调整
 */
export const MAX_UPLOAD_SIZE_BYTES = parseInt(
  (import.meta.env.VITE_MAX_UPLOAD_SIZE_MB as string) || '1024',
  10,
) * 1024 * 1024
