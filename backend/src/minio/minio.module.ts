import { Global, Module } from '@nestjs/common'
import { MinioService } from './minio.service'

/**
 * MinIO 基础设施模块
 *
 * 全局导出 MinioService，方便其他模块（StorageModule、UploadModule）注入使用。
 */
@Global()
@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
