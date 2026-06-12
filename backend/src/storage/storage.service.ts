import { Injectable, Logger } from '@nestjs/common'
import * as path from 'path'
import { createHash, randomUUID } from 'crypto'
import { MinioService } from '../minio/minio.service'

/** 上传进度回调类型（保留兼容） */
export type ProgressCallback = (percent: number) => void

/** 上传结果（保留兼容） */
export interface UploadResult {
  /** 文件公开访问 URL */
  url: string
  /** 文件在 MinIO 中的 objectKey */
  fileKey: string
}

/** 业务类型映射表 */
const BIZ_TYPE_PATH: Record<string, string> = {
  'model': 'labs/models',
  'model-version': 'labs/models',
  'resource-image': 'labs/images',
  'resource-video': 'labs/videos',
  'marker-icon': 'labs/icons',
  'thumbnail': 'labs/thumbnails',
}

/** MIME 类型映射（按扩展名） */
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

/**
 * 文件存储服务（tapp → MinIO 重构）
 *
 * 保留 uploadFile/deleteFile 旧方法签名（内部走 MinIO）：
 *   - ModelsController / ResourcesController 仍以 multipart 接收整文件（后端代理）
 *   - 单文件 ≤ 8MB 时走 storageService.uploadFile
 *
 * 新增能力：
 *   - generateObjectKey: 按 bizType + 文件名生成 labs/{bizPath}/{yyyy}/{MM}/{uuid}.{ext}
 *   - verifyObject: 用 MinIO statObject 校验文件是否存在
 *   - getPublicUrl: 拼 ${MINIO_PUBLIC_URL}/${bucket}/${key}
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)

  constructor(
    private readonly minioService: MinioService,
  ) {}

  // ── 旧接口（保留兼容） ─────────────────────────────────────────

  /**
   * 单文件上传（≤ 8MB 走这里，给后端代理路径用）
   * 内部走 MinIO putObject
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    subPath?: string,
    onProgress?: ProgressCallback,
    customBasePath?: string,
  ): Promise<UploadResult> {
    const ext = path.extname(fileName).toLowerCase()
    const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream'

    // 兼容旧调用方式：customBasePath 包含 'labs/images'、'labs/videos' 等
    // 新调用方式应使用 generateObjectKey
    let key: string
    if (customBasePath) {
      // 防御性检查：subPath 若包含 '/' 或 '..' 会污染路径，置为 undefined
      // 历史 bug：uploadVersion 曾误把 modelId 当 subPath 传入，导致 objectKey
      // 变成 labs/models/{modelId}/2026/06/{uuid}.glb（应当是 labs/models/2026/06/...）
      const safeSubPath =
        subPath && !subPath.includes('/') && !subPath.includes('\\') && subPath !== '..' && subPath !== '.'
          ? subPath
          : undefined
      const base = safeSubPath ? `${customBasePath}/${safeSubPath}` : customBasePath
      key = `${base}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${randomUUID()}${ext || '.bin'}`
    } else {
      key = this.generateObjectKey('model', fileName)
    }

    await this.minioService.putObject(key, fileBuffer, mimeType)

    // 旧 onProgress 兼容：单次 PUT，无真实进度
    onProgress?.(100)

    return {
      url: this.minioService.getPublicUrl(key),
      fileKey: key,
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(fileKey: string): Promise<void> {
    if (!fileKey) return
    await this.minioService.removeObject(fileKey)
  }

  // ── 新接口 ─────────────────────────────────────────

  /**
   * 生成 MinIO objectKey
   * 格式：labs/{bizPath}/{yyyy}/{MM}/{uuid}.{ext}
   */
  generateObjectKey(
    bizType: keyof typeof BIZ_TYPE_PATH | string,
    fileName: string,
  ): string {
    const basePath = BIZ_TYPE_PATH[bizType] || 'labs/misc'
    const ext = path.extname(fileName).toLowerCase() || '.bin'
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${basePath}/${yyyy}/${mm}/${randomUUID()}${ext}`
  }

  /**
   * 校验 objectKey 是否真实存在于 MinIO
   * @returns { exists, size? }
   */
  async verifyObject(fileKey: string): Promise<{ exists: boolean; size?: number }> {
    if (!fileKey) return { exists: false }
    try {
      const stat = await this.minioService.statObject(fileKey)
      return { exists: true, size: stat.size }
    } catch (e: any) {
      this.logger.warn(`verifyObject(${fileKey}) 失败: ${e?.message || e}`)
      return { exists: false }
    }
  }

  /**
   * 公开访问 URL
   */
  getPublicUrl(fileKey: string): string {
    if (!fileKey) return ''
    return this.minioService.getPublicUrl(fileKey)
  }

  /**
   * 计算文件 SHA256 哈希（保留兼容） */
  calculateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  /** 检测文件格式（保留兼容） */
  detectFormat(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase().replace('.', '')
    return ext || 'glb'
  }
}
