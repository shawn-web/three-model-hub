import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduleModule } from '@nestjs/schedule'
import { ModelsModule } from './models/models.module'
import { ScenesModule } from './scenes/scenes.module'
import { SharingModule } from './sharing/sharing.module'
import { ViewpointsModule } from './viewpoints/viewpoints.module'
import { AnnotationsModule } from './annotations/annotations.module'
import { UploadModule } from './upload/upload.module'
import { ResourcesModule } from './resources/resources.module'
import { GeoMapsModule } from './geo-maps/geo-maps.module'
import { MinioModule } from './minio/minio.module'

/**
 * 根模块
 * 配置全局数据库连接和导入业务模块
 */
@Module({
  imports: [
    // 环境变量配置
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    // TypeORM 数据库连接
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'three_mode',
      // 自动加载所有 Entity
      autoLoadEntities: true,
      // 开发环境自动同步表结构（生产环境应使用 migration）
      synchronize: process.env.NODE_ENV !== 'production',
      charset: 'utf8mb4',
      logging: process.env.DB_LOGGING === 'true',
    }),
    // 定时任务模块（用于 UploadCleanupService 清理孤儿 session）
    ScheduleModule.forRoot(),
    // MinIO 基础设施（@Global() 全局可用）
    MinioModule,
    ModelsModule,
    ScenesModule,
    SharingModule,
    ViewpointsModule,
    AnnotationsModule,
    UploadModule,
    ResourcesModule,
    GeoMapsModule,
  ],
})
export class AppModule {}
