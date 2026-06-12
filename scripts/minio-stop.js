#!/usr/bin/env node
/**
 * MinIO 进程终止脚本（跨平台）
 *
 * 使用方法：
 *   node scripts/minio-stop.js
 *   pnpm minio:stop
 *
 * 行为：
 *   1. 扫描本机 9000 端口（MinIO 数据端口）的占用进程
 *   2. 找到 PID 后发送终止信号
 *   3. 等待最多 3 秒，进程仍在则强杀
 *   4. 找不到进程则正常退出（幂等）
 *
 * 平台适配：
 *   - Windows：netstat + taskkill
 *   - macOS / Linux：lsof + kill
 */
const { execSync, spawn } = require('child_process')
const os = require('os')

const PORT = 9000
const TIMEOUT_MS = 3000
const isWindows = os.platform() === 'win32'

function log(level, msg) {
  const tag = { info: '▶', ok: '✓', warn: '⚠', err: '✗' }[level] || '·'
  console.log(`${tag} ${msg}`)
}

/** 查找占用 PORT 的进程 PID 列表 */
function findPidsByPort(port) {
  try {
    if (isWindows) {
      // netstat -ano 列出所有连接，findstr 过滤 LISTENING 行
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' })
      const pids = new Set()
      for (const line of out.split(/\r?\n/)) {
        // 期望格式：  TCP    0.0.0.0:9000    0.0.0.0:0    LISTENING    1234
        const m = line.match(/LISTENING\s+(\d+)/i)
        if (m) pids.add(m[1])
      }
      return [...pids]
    } else {
      // lsof -ti:port 输出占用端口的 PID 列表（-t 仅输出 PID）
      const out = execSync(`lsof -ti:${port} -sTCP:LISTEN`, { encoding: 'utf-8' })
      return out.split(/\s+/).filter(Boolean)
    }
  } catch (e) {
    // netstat/lsof 没找到匹配项会返回非 0 退出码，视为无占用
    return []
  }
}

/** 向 PID 发送终止信号 */
function killPid(pid) {
  try {
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
    } else {
      // 先 SIGTERM 让进程优雅退出
      try {
        process.kill(parseInt(pid, 10), 'SIGTERM')
      } catch {
        // 进程已退出，忽略
      }
    }
    return true
  } catch (e) {
    log('warn', `终止 PID ${pid} 失败：${e.message}`)
    return false
  }
}

/** 检查 PID 是否仍在运行 */
function isAlive(pid) {
  try {
    if (isWindows) {
      const out = execSync(`tasklist /FI "PID eq ${pid}"`, { encoding: 'utf-8' })
      return out.includes(String(pid))
    } else {
      process.kill(parseInt(pid, 10), 0) // 信号 0 仅检查存活
      return true
    }
  } catch {
    return false
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  log('info', `扫描 ${PORT} 端口占用的 MinIO 进程...`)
  const pids = findPidsByPort(PORT)
  if (pids.length === 0) {
    log('ok', '端口未被占用，MinIO 未运行')
    process.exit(0)
  }

  log('info', `找到 ${pids.length} 个进程：${pids.join(', ')}`)

  for (const pid of pids) {
    log('info', `终止 PID ${pid}...`)
    killPid(pid)
  }

  // 等待进程退出
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    const stillAlive = pids.filter(isAlive)
    if (stillAlive.length === 0) {
      log('ok', 'MinIO 已停止')
      return
    }
    await sleep(200)
  }

  // 超时仍在，强杀（仅非 Windows 走 SIGKILL，Windows taskkill /F 已是强杀）
  const survivors = pids.filter(isAlive)
  if (survivors.length > 0) {
    log('warn', `${survivors.length} 个进程未响应，强制终止`)
    for (const pid of survivors) {
      if (!isWindows) {
        try {
          process.kill(parseInt(pid, 10), 'SIGKILL')
        } catch {}
      }
    }
  }

  log('ok', 'MinIO 已停止')
}

main().catch((e) => {
  log('err', `脚本异常：${e.message}`)
  process.exit(1)
})
