import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'

/**
 * API 客户端
 * 开发环境通过 vite proxy 代理到后端，生产环境使用相对路径
 *
 * 内置 GET 请求缓存：对幂等的 GET 请求进行短期内存缓存，
 * 避免页面刷新后重复请求相同的 API 数据（如模型列表、场景数据等）。
 */

/* ──────────────── GET 请求缓存 ──────────────── */

interface InternalConfig {
  __cacheHit?: AxiosResponse
}

interface HttpCacheEntry {
  response: AxiosResponse
  timestamp: number
}

/** GET 缓存过期时间（毫秒），默认 5 分钟 */
const HTTP_CACHE_TTL = 5 * 60 * 1000

/** GET 请求缓存：以 method+url+params 序列化为 key */
const httpCache = new Map<string, HttpCacheEntry>()

/**
 * 生成缓存 key：由 method、url、params、data 组合而成
 */
function getCacheKey(config: AxiosRequestConfig): string {
  return JSON.stringify({
    method: (config.method || 'get').toLowerCase(),
    url: config.url,
    params: config.params,
  })
}

/* ──────────────── Axios 实例 ──────────────── */

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/* 请求拦截器：GET 请求命中缓存时直接返回缓存响应 */
apiClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()

  // 仅对 GET 请求启用缓存，且可通过 config.headers.X-Skip-Cache 跳过
  if (method === 'get' && !config.headers?.['X-Skip-Cache']) {
    const key = getCacheKey(config)
    const entry = httpCache.get(key)

    if (entry && Date.now() - entry.timestamp < HTTP_CACHE_TTL) {
      // 标记为缓存命中，在响应拦截器中直接返回
      ;(config as InternalConfig).__cacheHit = entry.response
    }
  }

  return config
})

/* 响应拦截器：缓存 GET 响应 / 返回缓存命中结果 */
apiClient.interceptors.response.use(
  (response) => {
    const method = (response.config.method || 'get').toLowerCase()

    // 如果是缓存命中，直接返回缓存的响应
    const cached = (response.config as InternalConfig).__cacheHit
    if (cached) {
      return cached
    }

    // 缓存成功的 GET 响应
    if (method === 'get') {
      const key = getCacheKey(response.config)
      httpCache.set(key, { response, timestamp: Date.now() })
    }

    return response
  },
  (error) => {
    return Promise.reject(error)
  },
)

/**
 * 清除所有 HTTP GET 缓存。
 * 可在需要强制刷新 API 数据时调用。
 */
export function clearHttpCache(): void {
  httpCache.clear()
}

/**
 * 清除指定 URL 模式的 HTTP 缓存。
 * @param urlPattern 要清除的 URL 子串（包含该子串的缓存条目都会被移除）
 */
export function invalidateHttpCache(urlPattern: string): void {
  for (const [key] of httpCache) {
    if (key.includes(urlPattern)) {
      httpCache.delete(key)
    }
  }
}

export default apiClient
