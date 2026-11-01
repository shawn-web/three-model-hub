/**
 * 文件下载相关类型
 */

/** 下载进度回调参数 */
export interface DownloadProgress {
  /** 已下载字节数 */
  loaded: number
  /** 总字节数 */
  total: number
}

/** 下载选项 */
export interface DownloadOptions {
  /** 进度回调 */
  onProgress?: (progress: DownloadProgress) => void
  /** 取消信号 */
  signal?: AbortSignal
}
