import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Client } from 'minio'

/**
 * MinIO 客户端封装
 *
 * 职责：
 *   1. 构造并管理 minio.Client 单例
 *   2. onModuleInit 自动检测 bucket，不存在则创建 + 设置 download 匿名策略
 *   3. 封装常用的对象操作（put/multipart/remove/stat）
 *
 * 错误处理：
 *   - 初始化失败抛错阻止 NestJS 启动（避免在错误状态下接收请求）
 *   - 业务调用失败由调用方决定如何处理
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name)
  private client: Client
  private readonly bucket: string
  private readonly endpoint: string
  private readonly port: number
  private readonly useSSL: boolean
  private readonly publicUrl: string

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost')
    this.port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10)
    this.useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true'
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'three-mode')
    this.publicUrl = this.config.get<string>('MINIO_PUBLIC_URL', `http://${this.endpoint}:${this.port}`)

    // 客户端在构造函数中初始化（避免 onModuleInit 被测试覆盖）
    this.client = new Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    })
  }

  /**
   * 模块初始化：自动创建 bucket（保持私有读，访问走 NestJS 代理）
   */
  async onModuleInit(): Promise<void> {
    const url = `${this.useSSL ? 'https' : 'http'}://${this.endpoint}:${this.port}`
    this.logger.log(`MinIO client connected to ${url}`)
    await this.ensureBucket()
  }

  /**
   * 检测 bucket 是否存在，不存在则创建
   *
   * 注意：bucket 保持私有读，前端访问全部走 NestJS /api/storage/:bucket/* 代理。
   * 这样可以在代理层加 token / 权限 / 限速等，避免直接暴露 MinIO 端点。
   */
  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket)
      if (!exists) {
        await this.client.makeBucket(this.bucket, this.config.get<string>('MINIO_REGION', 'us-east-1'))
        this.logger.log(`bucket '${this.bucket}' 已创建（私有读，访问走 NestJS 代理）`)
      } else {
        this.logger.log(`bucket '${this.bucket}' 已存在，跳过创建`)
      }
      this.logger.log(`bucket '${this.bucket}' 已就绪`)
    } catch (e: any) {
      this.logger.error(`bucket 初始化失败: ${e?.message || e}`)
      throw e
    }
  }

  // ── 业务方法 ─────────────────────────────────────────

  /**
   * 简单上传（用于 < 8MB 文件直传）
   */
  async putObject(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    })
  }

  /**
   * 初始化分片上传
   * @returns MinIO 返回的 uploadId
   */
  async initMultipart(key: string): Promise<string> {
    // minio 8.x：initiateNewMultipartUpload 直接返回 Promise<string>
    return this.client.initiateNewMultipartUpload(this.bucket, key, {})
  }

  /**
   * 上传单个分片
   * @returns MinIO 返回的 ETag（合并时需要）
   */
  async uploadPart(uploadId: string, key: string, partNumber: number, buffer: Buffer): Promise<string> {
    // minio 8.x：uploadPart 接收单一对象参数
    const result = await this.client.uploadPart({
      bucketName: this.bucket,
      objectName: key,
      uploadID: uploadId,
      partNumber,
      headers: {},
    }, buffer)
    return result.etag
  }

  /**
   * 合并分片
   * @returns MinIO 返回的 etag
   */
  async completeMultipart(
    uploadId: string,
    key: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<{ etag: string; size?: number }> {
    // minio 8.x：etags 数组的字段名是 `part` 而非 `partNumber`
    const etags = parts.map((p) => ({ part: p.partNumber, etag: p.etag }))
    return this.client.completeMultipartUpload(this.bucket, key, uploadId, etags)
  }

  /**
   * 取消分片上传（释放 MinIO 端分片数据）
   */
  async abortMultipart(uploadId: string, key: string): Promise<void> {
    try {
      await this.client.abortMultipartUpload(this.bucket, key, uploadId)
    } catch (e: any) {
      this.logger.warn(`abortMultipart 失败: ${e?.message || e}`)
    }
  }

  /**
   * 列出 MinIO 中某 uploadId 已上传的分片（断点续传时校对）
   *
   * minio 8.x：listParts 是 protected 方法，外部无法直接调用。
   * 这里通过 listIncompleteUploads 拿到所有未完成上传的元数据，
   * 然后从 session.uploaded_parts（DB 端单一真相源）拼出 part 列表。
   *
   * 注：断点续传的真实状态以 UploadSession.uploaded_parts 为准，
   *     本方法仅作为可选校对，外部调用时仍优先用 session 自身数据。
   */
  async listParts(uploadId: string, _key: string): Promise<{ partNumber: number; etag: string }[]> {
    // minio 8 没有公开的 listParts API，直接返回空数组
    // 调用方应使用 UploadSession.uploaded_parts 作为权威数据源
    this.logger.debug(`listParts(${uploadId}) noop in minio 8, fallback to session.uploaded_parts`)
    return []
  }

  /**
   * 删除对象（删除模型/资源时调用）
   */
  async removeObject(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key)
    } catch (e: any) {
      this.logger.warn(`removeObject(${key}) 失败: ${e?.message || e}`)
    }
  }

  /**
   * 查询对象元数据（用于 verifyObject）
   * @throws NotFound 或其他 MinIO 错误
   */
  async statObject(key: string): Promise<{ size: number; lastModified: Date; etag: string }> {
    const stat = await this.client.statObject(this.bucket, key)
    return {
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
    }
  }

  /**
   * 列出 bucket 中所有对象（供管理接口查看文件列表）
   * @param prefix 可选前缀过滤
   */
  async listObjects(prefix?: string): Promise<{ name: string; size: number; lastModified: Date }[]> {
    const objects: { name: string; size: number; lastModified: Date }[] = []
    const stream = this.client.listObjects(this.bucket, prefix || '', true)
    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) {
          objects.push({ name: obj.name, size: obj.size, lastModified: obj.lastModified })
        }
      })
      stream.on('end', () => resolve(objects))
      stream.on('error', (err) => reject(err))
    })
  }

  /**
   * 获取对象流（用于后端代理下载，前端不再直连 MinIO）
   * @returns ReadableStream + 元数据
   */
  async getObjectStream(key: string): Promise<{
    stream: NodeJS.ReadableStream
    size: number
    contentType: string
    etag: string
    lastModified: Date
  }> {
    const stat = await this.client.statObject(this.bucket, key)
    const stream = await this.client.getObject(this.bucket, key)
    return {
      stream,
      size: stat.size,
      contentType: stat.metaData?.['content-type'] || 'application/octet-stream',
      etag: stat.etag,
      lastModified: stat.lastModified,
    }
  }

  /**
   * 拼接公开访问 URL（改为返回相对路径，由 NestJS /api/storage/:bucket/* 代理转发）
   *
   * 这样前端拿到 url 后直接用，无需关心 MinIO 公网域名，
   * 也避免 CORS 问题（前端只与 5173/3000 同源）。
   */
  getPublicUrl(key: string): string {
    if (!key) return ''
    return `/api/storage/${this.bucket}/${key}`
  }

  /** 暴露 bucket 名（供其他模块生成 objectKey 时用） */
  getBucket(): string {
    return this.bucket
  }
}
