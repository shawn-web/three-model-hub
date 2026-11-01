#!/usr/bin/env node
/**
 * 将根目录文档同步到前端内置文档页面（frontend/src/docs/）。
 *
 * 用法：
 *   node scripts/sync-docs.js          复制并覆盖目标文件
 *   node scripts/sync-docs.js --check  仅校验是否一致；不一致时退出码 1（供 CI 使用）
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DEST_DIR = path.join(ROOT, 'frontend', 'src', 'docs')

/** 源文件（相对仓库根） -> 目标文件名 */
const MAP = [
  ['README.md', 'readme.md'],
  ['CHANGELOG.md', 'changelog.md'],
  ['CONTRIBUTING.md', 'contributing.md'],
  ['docs/api.md', 'api.md'],
  ['docs/architecture.md', 'architecture.md'],
  ['docs/development.md', 'development.md'],
  ['docs/testing.md', 'testing.md'],
  ['docs/deployment.md', 'deployment.md'],
]

const checkOnly = process.argv.includes('--check')

fs.mkdirSync(DEST_DIR, { recursive: true })

let drift = 0
for (const [srcRel, destName] of MAP) {
  const src = path.join(ROOT, srcRel)
  const dest = path.join(DEST_DIR, destName)

  if (!fs.existsSync(src)) {
    console.error(`[sync-docs] 源文件不存在: ${srcRel}`)
    process.exitCode = 1
    continue
  }

  const srcBuf = fs.readFileSync(src)
  const destBuf = fs.existsSync(dest) ? fs.readFileSync(dest) : null

  if (destBuf && srcBuf.equals(destBuf)) continue

  if (checkOnly) {
    console.error(`[sync-docs] 未同步: ${srcRel} -> frontend/src/docs/${destName}`)
    drift += 1
  } else {
    fs.copyFileSync(src, dest)
    console.log(`[sync-docs] 已同步 ${srcRel} -> frontend/src/docs/${destName}`)
  }
}

if (checkOnly && drift > 0) {
  console.error(`[sync-docs] 共 ${drift} 个文档未同步，请运行 pnpm sync:docs 后提交`)
  process.exit(1)
}

console.log(checkOnly ? '[sync-docs] 校验通过' : '[sync-docs] 同步完成')
