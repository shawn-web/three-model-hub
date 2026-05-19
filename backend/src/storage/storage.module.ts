import { Module } from '@nestjs/common'
import { StorageService } from './storage.service'

/**
 * 文件存储模块
 * 提供文件上传到远程文件服务的能力
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
