import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UploadController } from './upload.controller'
import { UploadService } from './upload.service'
import { UploadCleanupService } from './upload-cleanup.service'
import { UploadSession } from './entities/upload-session.entity'
import { MinioModule } from '../minio/minio.module'
import { StorageModule } from '../storage/storage.module'

/**
 * 上传模块
 *
 * 装配：
 *   - UploadSession 实体（TypeORM）
 *   - MinioService（来自全局 MinioModule）
 *   - StorageService（用于生成 objectKey）
 *   - UploadCleanupService（定时清理 24h+ pending session）
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UploadSession]),
    MinioModule,
    StorageModule,
  ],
  controllers: [UploadController],
  providers: [UploadService, UploadCleanupService],
  exports: [UploadService],
})
export class UploadModule {}
