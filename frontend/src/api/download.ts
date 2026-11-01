import type { DownloadProgress, DownloadOptions } from '../types/download'

/** 单次分片大小（与服务端 CHUNK_SIZE 对齐） */
const DOWNLOAD_CHUNK_SIZE = 8 * 1024 * 1024

/** 分片并发上限 */
const DOWNLOAD_CONCURRENT = 6

/**
 * 小文件阈值：小于该阈值走单次下载，不再分片
 * 设 32MB 是因为单次下载对小文件收益不明显，分片反而引入复杂度与重试成本
 */
const DOWNLOAD_THRESHOLD = 32 * 1024 * 1024

/**
 * 通用分片下载工具
 *
 * 原理：
 *   1. 用 Range: bytes=0-0 探测服务端是否支持 Range + 拿到总大小
 *   2. < 阈值：直接 `<a download>` 触发浏览器下载
 *   3. ≥ 阈值：按 8MB 切片，6 路并发 fetch + Range 拉字节，合并 Blob 触发下载
 *
 * 取消：传 signal，中途任意一次 fetch 失败会终止并抛 AbortError
 *
 * 大小：返回 Blob 总字节数与已下载字节数
 */
export async function downloadFileByChunk(
  url: string,
  fileName: string,
  options: DownloadOptions = {},
): Promise<void> {
  // 1. 探测 Range 支持 + 总大小
  let supportRange: boolean
  let total = 0
  try {
    const probe = await fetch(url, {
      headers: { Range: 'bytes=0-0' },
      signal: options.signal,
    })
    supportRange = probe.status === 206
    const contentRange = probe.headers.get('content-range')
    if (contentRange) {
      const idx = contentRange.lastIndexOf('/')
      if (idx >= 0) total = parseInt(contentRange.slice(idx + 1), 10)
    }
    // 必须显式消费 body，否则连接不释放，触发浏览器并发连接上限后挂起
    // 部分浏览器不支持 ReadableStream.cancel()，用 try/catch 兜底
    if (probe.body) {
      try {
        await probe.body.cancel()
      } catch {
        // ignore
      }
    }
  } catch {
    // 探测失败 = 当前网络异常，直接抛
    throw new Error('分片下载探测失败，请稍后重试')
  }

  if (!supportRange || total < DOWNLOAD_THRESHOLD) {
    // total=0 时仍允许单次下载（浏览器下载进度不可知），但不伪造 100%
    triggerDirectDownload(url, fileName)
    if (total > 0) options.onProgress?.({ loaded: total, total })
    return
  }

  // 2. 计算分片范围
  const chunkCount = Math.ceil(total / DOWNLOAD_CHUNK_SIZE)
  const chunks: Blob[] = new Array<Blob>(chunkCount)
  let downloaded = 0
  const reportProgress = (delta: number) => {
    downloaded += delta
    options.onProgress?.({ loaded: downloaded, total })
  }

  const fetchChunk = async (index: number): Promise<void> => {
    const start = index * DOWNLOAD_CHUNK_SIZE
    const end = Math.min(start + DOWNLOAD_CHUNK_SIZE - 1, total - 1)
    const resp = await fetch(url, {
      headers: { Range: `bytes=${start}-${end}` },
      signal: options.signal,
    })
    if (resp.status !== 206) {
      throw new Error(`分片 ${index} 下载失败（HTTP ${resp.status}）`)
    }
    const blob = await resp.blob()
    chunks[index] = blob
    reportProgress(blob.size)
  }

  // 3. N 路并发拉分片
  const queue: number[] = Array.from({ length: chunkCount }, (_, i) => i)
  // 共享 AbortController：任一 worker 失败时取消其余 worker，避免孤儿下载
  const internalAbort = new AbortController()
  const onExternalAbort = () => internalAbort.abort()
  options.signal?.addEventListener('abort', onExternalAbort)
  const effectiveSignal = internalAbort.signal

  const workers = Array.from({ length: Math.min(DOWNLOAD_CONCURRENT, chunkCount) }, async () => {
    while (queue.length > 0) {
      if (effectiveSignal.aborted) {
        throw new DOMException('Download aborted', 'AbortError')
      }
      const idx = queue.shift()!
      try {
        await fetchChunk(idx)
      } catch (e) {
        // 任一 worker 失败，取消其余 worker
        internalAbort.abort()
        throw e
      }
    }
  })
  try {
    await Promise.all(workers)
  } finally {
    options.signal?.removeEventListener('abort', onExternalAbort)
  }

  // 4. 合并 Blob 并触发下载
  const blob = new Blob(chunks, { type: 'application/octet-stream' })
  triggerBlobDownload(blob, fileName)
}

/** 触发直接下载（仅设置 href/download，浏览器接管） */
function triggerDirectDownload(url: string, fileName: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 触发 Blob 下载 */
function triggerBlobDownload(blob: Blob, fileName: string): void {
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 给浏览器足够时间完成下载再释放对象 URL（30 秒，覆盖"另存为"对话框场景）
  setTimeout(() => URL.revokeObjectURL(objUrl), 30000)
}

// 引用占位避免 unused import 警告
export type { DownloadProgress, DownloadOptions }
