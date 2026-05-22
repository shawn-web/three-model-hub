import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Model } from './entities/model.entity'
import { ModelVersion } from './entities/model-version.entity'
import { SceneModel } from '../scenes/entities/scene-model.entity'
import { ModelsController } from './models.controller'
import { ModelsService } from './models.service'
import { StorageModule } from '../storage/storage.module'

/**
 * 模型管理模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Model, ModelVersion, SceneModel]),
    StorageModule,
  ],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
