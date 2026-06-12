import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { GeoMapsService } from './geo-maps.service'
import { GeoMapsController } from './geo-maps.controller'
import { GeoMap } from './entities/geo-map.entity'
import { GeoMapModel } from './entities/geo-map-model.entity'
import { Model } from '../models/entities/model.entity'

/**
 * 地理地图模块
 * 独立管理 3D 模型在地球表面的地理定位
 */
@Module({
  imports: [TypeOrmModule.forFeature([GeoMap, GeoMapModel, Model])],
  controllers: [GeoMapsController],
  providers: [GeoMapsService],
  exports: [GeoMapsService],
})
export class GeoMapsModule {}
