import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThan, Repository } from 'typeorm'
import { Cron, CronExpression } from '@nestjs/schedule'
import { UploadSession } from './entities/upload-session.entity'
import { MinioService } from '../minio/minio.service'

/**
 * 分片上传孤儿 session 清理
 *
 * 场景：用户上传中关闭页面/断网/上传失败，UploadSession 一直处于 pending 状态。
 *       定时清理 24 小时以上的 pending session：
 *         1. 调 MinIO abortMultipart 释放分片数据
 *         2. 标记 session.status='aborted'
 *
 * 触发：每天凌晨 3 点（CronExpression.EVERY_DAY_AT_3AM）
 * 阈值：24 小时（可通过 .env 调整 CLEANUP_THRESHOLD_HOURS）
 */
@Injectable()
export class UploadCleanupService {
  private readonly logger = new Logger(UploadCleanupService.name)
  private readonly thresholdHours = parseInt(process.env.UPLOAD_CLEANUP_THRESHOLD_HOURS || '24', 10)

  constructor(
    @InjectRepository(UploadSession)
    private readonly sessionRepo: Repository<UploadSession>,
    private readonly minioService: MinioService,
  ) {}

  /**
   * 每日凌晨 3 点扫描清理
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupStaleSessions(): Promise<void> {
    const threshold = new Date(Date.now() - this.thresholdHours * 60 * 60 * 1000)
    this.logger.log(`开始扫描 ${this.thresholdHours}h+ 的 pending upload_sessions...`)

    const stale = await this.sessionRepo.find({
      where: {
        status: 'pending',
        created_at: LessThan(threshold),
      },
      take: 100, // 防止单次清理过多
    })

    if (stale.length === 0) {
      this.logger.log('无过期 session，跳过清理')
      return
    }

    this.logger.log(`找到 ${stale.length} 个过期 session，开始清理`)

    for (const session of stale) {
      try {
        await this.minioService.abortMultipart(session.upload_id, session.object_key)
        session.status = 'aborted'
        await this.sessionRepo.save(session)
        this.logger.log(`已清理 ${session.object_key} (upload_id=${session.upload_id})`)
      } catch (e: any) {
        this.logger.warn(`清理 ${session.object_key} 失败: ${e?.message || e}`)
      }
    }

    this.logger.log(`本次清理完成，共处理 ${stale.length} 个 session`)
  }
}
