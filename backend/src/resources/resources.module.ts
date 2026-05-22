import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Resource } from './entities/resource.entity'
import { ResourceGroup } from './entities/resource-group.entity'
import { ResourcesController } from './resources.controller'
import { ResourcesService } from './resources.service'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Resource, ResourceGroup]),
    StorageModule,
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
