import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'

/**
 * API 客户端
 * 开发环境通过 vite proxy 代理到后端，生产环境使用相对路径
 *
 * 内置 GET 请求缓存：对幂等的 GET 请求进行短期内存缓存，
 * 避免页面刷新后重复请求相同的 API 数据（如模型列表、场景数据等）。
 * 缓存命中时直接返回、不发网络请求。
 */

/* ──────────────── GET 请求缓存 ──────────────── */

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

/** 查找未过期的缓存命中（命中则返回克隆的响应，否则返回 null） */
function findCacheHit(config: AxiosRequestConfig): AxiosResponse | null {
  const method = (config.method || 'get').toLowerCase()
  if (method !== 'get' || config.headers?.['X-Skip-Cache']) return null
  const key = getCacheKey(config)
  const entry = httpCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp >= HTTP_CACHE_TTL) {
    httpCache.delete(key)
    return null
  }
  // 返回一份浅拷贝，避免调用方修改污染缓存源对象
  return {
    ...entry.response,
    data: entry.response.data,
    headers: { ...entry.response.headers },
    config: config as AxiosResponse['config'],
  }
}

/* ──────────────── Axios 实例 ──────────────── */

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/* 请求拦截器：FormData Content-Type 处理 + GET 缓存命中跳过请求 */
apiClient.interceptors.request.use((config) => {
  // FormData 请求（文件上传）需要由浏览器自动设置 Content-Type 和 boundary，
  // 不能沿用默认的 application/json，否则后端 multer 无法解析 multipart 数据。
  if (config.data instanceof FormData) {
    config.headers['Content-Type'] = undefined
  }
  // GET 缓存命中：通过 adapter 短路返回缓存响应，不发网络请求
  const cached = findCacheHit(config)
  if (cached) {
    config.adapter = () => Promise.resolve(cached)
  }
  return config
})

/* 响应拦截器：缓存成功的 GET 响应 */
apiClient.interceptors.response.use(
  (response) => {
    const method = (response.config.method || 'get').toLowerCase()
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
