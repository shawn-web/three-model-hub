import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Viewpoint } from './entities/viewpoint.entity'
import { ViewpointsController } from './viewpoints.controller'
import { ViewpointsService } from './viewpoints.service'

/**
 * 视点管理模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([Viewpoint])],
  controllers: [ViewpointsController],
  providers: [ViewpointsService],
  exports: [ViewpointsService],
})
export class ViewpointsModule {}
