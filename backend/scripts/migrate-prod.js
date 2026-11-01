/**
 * 生产环境 migration 运行脚本
 * 在已编译的 dist 目录上直接运行 TypeORM migration，不依赖 ts-node。
 * 用于 Docker 生产镜像启动前执行：node scripts/migrate-prod.js && node dist/main.js
 */
const path = require('path')
const { DataSource } = require('typeorm')

// 尝试加载 .env（容器内通常已通过环境变量注入，本地测试时可选）
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
} catch {
  // 无 dotenv 时跳过，依赖环境变量
}

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'three_model_hub',
  charset: 'utf8mb4',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [path.join(__dirname, '..', 'dist', '**', '*.entity.js')],
  migrations: [path.join(__dirname, '..', 'dist', 'migrations', '*.js')],
})

async function main() {
  await dataSource.initialize()
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' })
    console.log(`migration 完成，本次应用 ${applied.length} 个`)
  } finally {
    await dataSource.destroy()
  }
}

main().catch((err) => {
  console.error('migration 失败:', err)
  process.exit(1)
})
