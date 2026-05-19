import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Scene } from './entities/scene.entity'
import { SceneModel } from './entities/scene-model.entity'
import { ScenesController } from './scenes.controller'
import { ScenesService } from './scenes.service'

/**
 * 场景管理模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([Scene, SceneModel])],
  controllers: [ScenesController],
  providers: [ScenesService],
  exports: [ScenesService],
})
export class ScenesModule {}
