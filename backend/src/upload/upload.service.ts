import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UploadSession } from './entities/upload-session.entity'
import { MinioService } from '../minio/minio.service'
import { StorageService } from '../storage/storage.service'
import { InitMultipartDto } from './dto/init-multipart.dto'
import { CompleteMultipartDto } from './dto/complete-multipart.dto'
import { MulterFile } from '../common/types'

/** 分片大小：8MB（与前端 chunk size 对齐） */
export const CHUNK_SIZE = 8 * 1024 * 1024

/**
 * 上传业务编排服务
 *
 * 职责：
 *   - 维护 UploadSession 状态机
 *   - 协调 MinioService 完成 multipart upload 流程
 *   - 暴露状态查询（断点续传）
 *
 * 状态机：
 *   pending → completed（成功合并）
 *   pending → aborted（用户取消 / 定时清理）
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)

  constructor(
    @InjectRepository(UploadSession)
    private readonly sessionRepo: Repository<UploadSession>,
    private readonly minioService: MinioService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * 初始化分片上传
   * - 生成 objectKey
   * - 调 MinIO initMultipart 拿 uploadId
   * - 写 UploadSession (pending)
   */
  async initMultipart(dto: InitMultipartDto): Promise<{
    uploadId: string
    objectKey: string
    partSize: number
    totalParts: number
  }> {
    const objectKey = this.storageService.generateObjectKey(dto.bizType, dto.fileName)
    const uploadId = await this.minioService.initMultipart(objectKey)
    const totalParts = Math.ceil(dto.fileSize / CHUNK_SIZE)

    const session = this.sessionRepo.create({
      upload_id: uploadId,
      object_key: objectKey,
      bucket: this.minioService.getBucket(),
      file_name: dto.fileName,
      file_size: dto.fileSize,
      mime_type: dto.mimeType,
      biz_type: dto.bizType,
      status: 'pending',
      uploaded_parts: {},
    })
    await this.sessionRepo.save(session)

    this.logger.log(`init multipart: ${objectKey} (${totalParts} parts, ${dto.fileSize} bytes)`)

    return {
      uploadId,
      objectKey,
      partSize: CHUNK_SIZE,
      totalParts,
    }
  }

  /**
   * 上传单个分片
   * - 校验 session 存在且未完成
   * - 调 MinIO uploadPart 拿 ETag
   * - 原子写入 session.uploaded_parts（避免并发 read-modify-write 丢分片）
   *
   * 并发安全：前端 MAX_CONCURRENT_PARTS=3 并发上传分片时，简单的
   * 「读 → 改 → 写」会出现 T1 写 part 2 → T2 写 part 3 时覆盖 part 2。
   * 改用 MySQL JSON_SET 单条 UPDATE 原子合并，保证不丢分片。
   */
  async uploadPart(
    uploadId: string,
    partNumber: number,
    buffer: Buffer,
  ): Promise<{ etag: string; partNumber: number }> {
    const session = await this.sessionRepo.findOne({ where: { upload_id: uploadId } })
    if (!session) {
      throw new NotFoundException(`上传任务不存在：${uploadId}`)
    }
    if (session.status !== 'pending') {
      throw new BadRequestException(`上传任务已 ${session.status}，不能修改`)
    }

    const etag = await this.minioService.uploadPart(uploadId, session.object_key, partNumber, buffer)

    // 原子合并：JSON_SET 在单条 UPDATE 内加键，并行分片互不覆盖。
    // status='pending' 条件防止「在 abort 之后写」/「在 cleanup 之后写」。
    const jsonPath = `$."${partNumber}"`
    const result = await this.sessionRepo.query(
      `UPDATE upload_sessions
       SET uploaded_parts = JSON_SET(COALESCE(uploaded_parts, JSON_OBJECT()), ?, ?)
       WHERE upload_id = ? AND status = 'pending'`,
      [jsonPath, etag, uploadId],
    )
    // TypeORM query 对 UPDATE 返回 OkPacket（非数组），affectedRows=0 表示 session 已不处于 pending
    const rawResult = Array.isArray(result) ? result[0] : result
    const affected = (rawResult as { affectedRows?: number })?.affectedRows ?? 0
    if (affected === 0) {
      throw new BadRequestException(`上传任务已被取消或完成：${uploadId}`)
    }

    return { etag, partNumber }
  }

  /**
   * 合并分片
   * - 校验 session 存在
   * - 校验前端传入的 parts 与 session.uploaded_parts 完全一致（防止半完成 / 越权 complete）
   * - 调 MinIO completeMultipartUpload
   * - 标记 session.status=completed
   * - 返回公开 URL 和 fileKey
   */
  async completeMultipart(dto: CompleteMultipartDto): Promise<{
    url: string
    fileKey: string
    fileSize: number
  }> {
    const session = await this.sessionRepo.findOne({ where: { upload_id: dto.uploadId } })
    if (!session) {
      throw new NotFoundException(`上传任务不存在：${dto.uploadId}`)
    }
    if (session.status === 'completed') {
      // 幂等：已完成的请求直接返回结果
      return {
        url: this.minioService.getPublicUrl(session.object_key),
        fileKey: session.object_key,
        fileSize: Number(session.file_size),
      }
    }
    if (session.status === 'aborted') {
      throw new BadRequestException(`上传任务已取消：${dto.uploadId}`)
    }

    // 校验：前端传入的 parts 必须与 session.uploaded_parts 完全一致
    const recorded = session.uploaded_parts || {}
    const recordedKeys = Object.keys(recorded).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    const incomingKeys = dto.parts
      .map((p) => String(p.partNumber))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))

    if (recordedKeys.length !== incomingKeys.length
      || recordedKeys.some((k, i) => k !== incomingKeys[i])) {
      throw new BadRequestException(
        `分片清单与服务端记录不一致：服务端记录 ${recordedKeys.length} 个分片，请求传入 ${incomingKeys.length} 个`,
      )
    }
    // 校验：分片编号必须从 1 开始连续递增（禁止跳片，防止分片缺失导致文件不完整）
    for (let i = 0; i < recordedKeys.length; i++) {
      if (parseInt(recordedKeys[i], 10) !== i + 1) {
        throw new BadRequestException(
          '分片编号必须从 1 开始连续递增，禁止跳片（可能存在未上传完成的分片）',
        )
      }
    }
    for (const p of dto.parts) {
      const expected = recorded[String(p.partNumber)]
      if (!expected || expected !== p.etag) {
        throw new BadRequestException(
          `分片 ${p.partNumber} 的 etag 与服务端记录不一致`,
        )
      }
    }

    const parts = dto.parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag }))
    await this.minioService.completeMultipart(dto.uploadId, session.object_key, parts)

    session.status = 'completed'
    // session.uploaded_parts 已与请求一致，无需重写
    await this.sessionRepo.save(session)

    this.logger.log(`complete multipart: ${session.object_key}`)

    return {
      url: this.minioService.getPublicUrl(session.object_key),
      fileKey: session.object_key,
      fileSize: Number(session.file_size),
    }
  }

  /**
   * 取消分片上传
   * - 幂等：session 不存在直接返回 success
   * - 调 MinIO abortMultipart 释放分片数据
   * - 标记 session.status=aborted
   */
  async abort(uploadId: string): Promise<{ success: true }> {
    const session = await this.sessionRepo.findOne({ where: { upload_id: uploadId } })
    if (!session) {
      return { success: true }
    }
    if (session.status === 'completed') {
      return { success: true }
    }
    await this.minioService.abortMultipart(uploadId, session.object_key)
    session.status = 'aborted'
    await this.sessionRepo.save(session)
    this.logger.log(`abort multipart: ${session.object_key}`)
    return { success: true }
  }

  /**
   * 查询上传状态（断点续传）
   * - 直接读 UploadSession.uploaded_parts 作为权威数据源
   * - 不依赖 MinioService.listParts（minio 8.x 无公开 API，永远返回空）
   * - 仅返回 partNumber 列表，不返回 etag 映射（前端断点续传不读 etag）
   */
  async status(uploadId: string): Promise<{
    objectKey: string
    fileSize: number
    uploadedParts: number[]
  }> {
    const session = await this.sessionRepo.findOne({ where: { upload_id: uploadId } })
    if (!session) {
      throw new NotFoundException(`上传任务不存在：${uploadId}`)
    }

    // 已 completed/aborted 的不返回断点信息，前端应当重新走 init
    if (session.status !== 'pending') {
      return {
        objectKey: session.object_key,
        fileSize: Number(session.file_size),
        uploadedParts: [],
      }
    }

    const partsMap = session.uploaded_parts || {}
    const uploadedParts = Object.keys(partsMap)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b)

    return {
      objectKey: session.object_key,
      fileSize: Number(session.file_size),
      uploadedParts,
    }
  }

  /**
   * 简单上传（< 8MB 单次上传）
   * - 生成 objectKey
   * - 调 MinIO putObject
   * - 返回公开 URL
   */
  async uploadSimple(file: MulterFile, bizType: string): Promise<{
    url: string
    fileKey: string
    fileSize: number
  }> {
    const objectKey = this.storageService.generateObjectKey(bizType, file.originalname)
    await this.minioService.putObject(objectKey, file.buffer, file.mimetype || 'application/octet-stream')

    return {
      url: this.minioService.getPublicUrl(objectKey),
      fileKey: objectKey,
      fileSize: file.size,
    }
  }
}
