/**
 * 一次性数据库同步脚本
 * 首次部署时运行，用 synchronize: true 创建所有表
 * 运行方式：cd backend && npx ts-node -r tsconfig-paths/register scripts/sync-once.ts
 * 注意：此脚本不应在生产环境重复执行
 */
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

import { Model } from '../src/models/entities/model.entity'
import { ModelVersion } from '../src/models/entities/model-version.entity'
import { Scene } from '../src/scenes/entities/scene.entity'
import { SceneModel } from '../src/scenes/entities/scene-model.entity'
import { SceneImage } from '../src/scenes/entities/scene-image.entity'
import { ShareLink } from '../src/sharing/entities/share-link.entity'
import { Viewpoint } from '../src/viewpoints/entities/viewpoint.entity'
import { Annotation } from '../src/annotations/entities/annotation.entity'
import { Resource } from '../src/resources/entities/resource.entity'
import { ResourceGroup } from '../src/resources/entities/resource-group.entity'

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'three_mode',
  charset: 'utf8mb4',
  synchronize: true,
  entities: [
    Model, ModelVersion, Scene, SceneModel, SceneImage,
    ShareLink, Viewpoint, Annotation, Resource, ResourceGroup,
  ],
})

async function bootstrap() {
  console.log('[DB Sync] 开始同步数据库表结构...')
  await AppDataSource.initialize()
  console.log('[DB Sync] 数据库表结构同步完成')

  const tables = [
    'models', 'model_versions', 'scenes', 'scene_models', 'scene_images',
    'share_links', 'viewpoints', 'annotations', 'resources', 'resource_groups',
  ]
  for (const table of tables) {
    const result = await AppDataSource.query(`SHOW TABLES LIKE '${table}'`)
    console.log(`[DB Sync] 表 ${table}: ${result.length > 0 ? 'OK' : 'MISSING'}`)
  }

  await AppDataSource.destroy()
  console.log('[DB Sync] 完成。此脚本不应在生产环境重复执行。')
}

bootstrap().catch(err => {
  console.error('[DB Sync] 同步失败:', err)
  process.exit(1)
})
