import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Annotation } from './entities/annotation.entity'
import { AnnotationsController } from './annotations.controller'
import { AnnotationsService } from './annotations.service'

/**
 * 批注管理模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([Annotation])],
  controllers: [AnnotationsController],
  providers: [AnnotationsService],
  exports: [AnnotationsService],
})
export class AnnotationsModule {}
