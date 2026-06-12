import { Module } from '@nestjs/common'
import { StorageService } from './storage.service'
import { StorageController } from './storage.controller'
import { MinioModule } from '../minio/minio.module'

/**
 * 文件存储模块（tapp → MinIO 重构）
 *
 * 导出 StorageService，供 ModelsModule / ResourcesModule 调用。
 * 注册 StorageController 处理 /api/storage/:bucket/* 代理读取。
 * 依赖全局 MinioModule（已通过 @Global() 装饰器自动注入）。
 */
@Module({
  imports: [MinioModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
