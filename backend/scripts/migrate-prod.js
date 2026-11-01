/**
 * 生产环境 migration 运行脚本
 * 在已编译的 dist 目录上直接运行 TypeORM migration，不依赖 ts-node。
 * 用于 Docker 生产镜像启动前执行：node scripts/migrate-prod.js && node dist/main.js
 *
 * 空库自举说明
 * ------------------------------------------------------------------
 * 仓库里的 migration 全部是增量变更（ALTER TABLE / 新增单表），没有“基础建表”
 * 那一版；生产环境又是 synchronize=false，所以对全新数据库直接 runMigrations 会
 * 在第一条 ALTER TABLE 上失败，容器随即退出并进入重启循环。
 *
 * 因此这里增加首启自举：检测到库里一张表都没有时，
 *   1) 用 synchronize:true 按实体定义建出完整表结构（等价于“所有 migration
 *      叠加后的最终状态”）
 *   2) 把这些历史 migration 登记为已应用，避免随后的 runMigrations 重复建表
 * 已有数据的库不会走这条路径，仍按正常 migration 增量升级。
 *
 * 可通过 DB_AUTO_BOOTSTRAP=false 关闭该行为。
 */
const path = require('path')
const { DataSource } = require('typeorm')

// 尝试加载 .env（容器内通常已通过环境变量注入，本地测试时可选）
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
} catch {
  // 无 dotenv 时跳过，依赖环境变量
}

const DB_NAME = process.env.DB_DATABASE || 'three_model_hub'
const AUTO_BOOTSTRAP = process.env.DB_AUTO_BOOTSTRAP !== 'false'

/** 判定“库是否为空”依据的核心表 */
const CORE_TABLES = ['models', 'scenes', 'geo_maps']

/** 期望存在的全部业务表（仅用于自检告警，不参与自动修复） */
const EXPECTED_TABLES = [
  'models', 'model_versions', 'scenes', 'scene_models', 'scene_images',
  'share_links', 'viewpoints', 'annotations', 'resources', 'resource_groups',
  'upload_sessions', 'geo_maps', 'geo_map_models',
]

const baseOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: DB_NAME,
  charset: 'utf8mb4',
  logging: process.env.DB_LOGGING === 'true',
  entities: [path.join(__dirname, '..', 'dist', '**', '*.entity.js')],
  migrations: [path.join(__dirname, '..', 'dist', 'migrations', '*.js')],
}

/** 取当前库中已存在的表名 */
async function listTables(ds) {
  const rows = await ds.query(
    'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ?',
    [DB_NAME],
  )
  return rows.map((r) => r.name || r.TABLE_NAME || r.table_name)
}

/**
 * 按实体定义一次性建出完整表结构。
 * 单独开一个 synchronize:true 的连接，跑完即销毁，避免影响后续 migration 连接。
 */
async function bootstrapSchema() {
  const ds = new DataSource({ ...baseOptions, synchronize: true })
  await ds.initialize()
  try {
    console.log('[migrate] 已按实体定义创建表结构')
  } finally {
    await ds.destroy()
  }
}

/**
 * 把已加载的 migration 全部登记为已应用。
 *
 * 自举出的表结构已经是所有 migration 叠加后的终态，若不登记，
 * 随后的 runMigrations 会重复建表 / 重复建索引并失败。
 */
async function markMigrationsApplied(ds) {
  const runner = ds.createQueryRunner()
  try {
    await runner.query(
      'CREATE TABLE IF NOT EXISTS `migrations` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`timestamp` bigint NOT NULL, ' +
        '`name` varchar(255) NOT NULL, ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    )

    const migrations = ds.migrations || []
    let recorded = 0
    for (const m of migrations) {
      const name = m.name || (m.constructor && m.constructor.name)
      if (!name) continue
      // TypeORM 以类名末尾 13 位数字作为 timestamp
      const timestamp = parseInt(name.slice(-13), 10)
      if (Number.isNaN(timestamp)) continue

      const existing = await runner.query(
        'SELECT `id` FROM `migrations` WHERE `timestamp` = ? AND `name` = ?',
        [timestamp, name],
      )
      if (existing.length === 0) {
        await runner.query('INSERT INTO `migrations` (`timestamp`, `name`) VALUES (?, ?)', [
          timestamp,
          name,
        ])
        recorded += 1
      }
    }
    console.log(`[migrate] 已将 ${recorded} 个历史 migration 登记为已应用`)
  } finally {
    await runner.release()
  }
}

async function main() {
  const ds = new DataSource({ ...baseOptions, synchronize: false })
  await ds.initialize()

  let tables = null
  try {
    tables = await listTables(ds)
  } catch (e) {
    // 探测失败不应阻断启动：退化为老行为，直接跑 migration
    console.warn(`[migrate] 无法探测表结构，跳过空库自举检测：${e && e.message ? e.message : e}`)
  }

  if (tables && tables.length === 0) {
    await ds.destroy()
    if (!AUTO_BOOTSTRAP) {
      console.error('[migrate] 数据库为空且 DB_AUTO_BOOTSTRAP=false，无法继续。')
      process.exit(1)
    }

    console.log('[migrate] 检测到全新数据库，开始按实体定义初始化表结构…')
    await bootstrapSchema()

    const ds2 = new DataSource({ ...baseOptions, synchronize: false })
    await ds2.initialize()
    try {
      await markMigrationsApplied(ds2)
      const applied = await ds2.runMigrations({ transaction: 'each' })
      console.log(`[migrate] 自举完成，补跑 migration ${applied.length} 个`)

      try {
        const after = await listTables(ds2)
        const missing = EXPECTED_TABLES.filter((t) => !after.includes(t))
        if (missing.length > 0) {
          console.warn(`[migrate] 警告：以下表仍未创建 ${missing.join(', ')}`)
        }
      } catch {
        // 自检失败不影响部署结果
      }
    } finally {
      await ds2.destroy()
    }
    return
  }

  // 非空库：正常增量升级
  if (tables) {
    const missingCore = CORE_TABLES.filter((t) => !tables.includes(t))
    if (missingCore.length > 0) {
      console.warn(
        `[migrate] 警告：库非空但缺少核心表 [${missingCore.join(', ')}]，` +
          '自动建表可能影响既有数据，此处不做自动修复，请手动排查。',
      )
    }
  }

  try {
    const applied = await ds.runMigrations({ transaction: 'each' })
    console.log(`[migrate] migration 完成，本次应用 ${applied.length} 个`)

    try {
      const after = await listTables(ds)
      const missing = EXPECTED_TABLES.filter((t) => !after.includes(t))
      if (missing.length > 0) {
        console.warn(`[migrate] 警告：以下表缺失 ${missing.join(', ')}`)
      }
    } catch {
      // 自检失败不影响部署结果
    }
  } finally {
    if (ds.isInitialized) await ds.destroy()
  }
}

main().catch((err) => {
  console.error('[migrate] 失败:', err)
  process.exit(1)
})
