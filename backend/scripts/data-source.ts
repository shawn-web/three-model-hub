/**
 * TypeORM CLI 独立数据源配置
 * 用于 migration 生成和运行
 * 用法：pnpm migration:generate src/migrations/MigrationName
 *
 * 注意：此文件通过 typeorm CLI（ts-node）加载。
 * 为了避免 typeorm CLI 自带的 tsconfig 不认 @types/node / dotenv，
 * 这里全部用 require() 而非 import，绕过静态类型检查。
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')
const dotenv = require('dotenv')
const { DataSource } = require('typeorm')

// 加载 .env（与 NestJS 应用启动时一致）
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

// 实体直接列出来（避免 glob 在 typeorm CLI 编译时失效）
const { Model } = require('../src/models/entities/model.entity')
const { ModelVersion } = require('../src/models/entities/model-version.entity')
const { Scene } = require('../src/scenes/entities/scene.entity')
const { SceneModel } = require('../src/scenes/entities/scene-model.entity')
const { SceneImage } = require('../src/scenes/entities/scene-image.entity')
const { ShareLink } = require('../src/sharing/entities/share-link.entity')
const { Viewpoint } = require('../src/viewpoints/entities/viewpoint.entity')
const { Annotation } = require('../src/annotations/entities/annotation.entity')
const { Resource } = require('../src/resources/entities/resource.entity')
const { ResourceGroup } = require('../src/resources/entities/resource-group.entity')
const { UploadSession } = require('../src/upload/entities/upload-session.entity')
const { GeoMap } = require('../src/geo-maps/entities/geo-map.entity')
const { GeoMapModel } = require('../src/geo-maps/entities/geo-map-model.entity')

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'three_mode',
  charset: 'utf8mb4',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [
    Model, ModelVersion, Scene, SceneModel, SceneImage,
    ShareLink, Viewpoint, Annotation, Resource, ResourceGroup,
    UploadSession, GeoMap, GeoMapModel,
  ],
})

module.exports = AppDataSource
export = AppDataSource
