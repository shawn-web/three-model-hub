/**
 * TypeORM CLI 独立数据源配置
 * 用于 migration 生成和运行
 * 用法：pnpm migration:generate src/migrations/MigrationName
 */
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'three_mode',
  charset: 'utf8mb4',
  entities: [path.resolve(__dirname, '..', 'src/**/entities/*.entity.ts')],
  migrations: [path.resolve(__dirname, '..', 'src/migrations/*.ts')],
})
