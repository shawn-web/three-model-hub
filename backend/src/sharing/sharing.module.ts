import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ShareLink } from './entities/share-link.entity'
import { SharingController } from './sharing.controller'
import { SharingService } from './sharing.service'

/**
 * 分享管理模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([ShareLink])],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
