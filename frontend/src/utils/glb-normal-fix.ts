/**
 * GLB Cesium 兼容性修复工具
 * Cesium 渲染使用了各向异性（anisotropy）扩展但没有切线数据的 GLB 时，
 * 会触发 PBR shader 编译 bug（normalTexCoords 未声明）。
 * 此工具通过后端代理下载 GLB，解析并移除导致问题的材质扩展，绕过该问题。
 *
 * 优化：预处理后的 GLB 缓存到 IndexedDB，避免每次页面刷新都重新下载和处理
 */

const CACHE_DB_NAME = 'threeMode_glb_cache'
const CACHE_STORE_NAME = 'processed_glbs'
const CACHE_DB_VERSION = 2

/** 打开 IndexedDB 缓存数据库 */
function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      // 清除旧版本缓存（修复对齐 bug 后数据不兼容）
      if (request.result.objectStoreNames.contains(CACHE_STORE_NAME)) {
        request.result.deleteObjectStore(CACHE_STORE_NAME)
      }
      db.createObjectStore(CACHE_STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** 从 IndexedDB 读取缓存的 Blob */
async function getCachedBlob(modelId: string): Promise<Blob | null> {
  try {
    const db = await openCacheDB()
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readonly')
      const store = tx.objectStore(CACHE_STORE_NAME)
      const request = store.get(modelId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/** 将处理后的 Blob 写入 IndexedDB 缓存 */
async function setCachedBlob(modelId: string, blob: Blob): Promise<void> {
  try {
    const db = await openCacheDB()
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite')
    tx.objectStore(CACHE_STORE_NAME).put(blob, modelId)
  } catch {
    // 缓存写入失败不影响主流程
  }
}

/**
 * 通过后端代理下载 GLB 并移除法线贴图，返回 Blob URL
 * 使用后端代理端点（/api/models/:id/file）避免前端 CORS 限制
 * @param modelId 模型 ID（对应后端 Model 实体的 id）
 * @param fallbackUrl 预处理失败时的回退 URL（原始外部文件 URL）
 * @param onProgress 下载进度回调（0-100）
 * @returns 可用的模型 URL，如果所有路径都失败则返回 null
 */
export async function removeNormalTexturesFromGlb(
  modelId: string,
  fallbackUrl: string,
  onProgress?: (percent: number) => void,
): Promise<string | null> {
  // 优先从 IndexedDB 缓存读取（避免每次刷新都重新下载和处理）
  const cached = await getCachedBlob(modelId)
  if (cached) {
    console.log(`[GLB修复] 命中缓存: ${modelId}`)
    const blobUrl = URL.createObjectURL(cached)
    return blobUrl
  }

  try {
    // 通过后端代理下载（同源请求，无 CORS 问题）
    const apiUrl = import.meta.env.VITE_API_URL || '/api'
    const proxyUrl = `${apiUrl}/models/${modelId}/file`
    const response = await fetch(proxyUrl)
    if (!response.ok) {
      console.warn(`[GLB修复] 后端代理请求失败: ${proxyUrl} → ${response.status}`)
      // 回退到原始 URL
      return tryFallbackUrl(fallbackUrl)
    }

    // 使用 ReadableStream 跟踪下载进度（大模型文件需要实时反馈）
    const contentLength = Number(response.headers.get('Content-Length')) || 0
    const arrayBuffer = await readResponseWithProgress(response, contentLength, onProgress)

    // 验证是否为有效 GLB（避免后端返回 HTML 错误页面被误用）
    if (!isValidGlb(arrayBuffer)) {
      console.warn(`[GLB修复] 后端代理返回的不是有效 GLB 文件，跳过: ${modelId}`)
      return tryFallbackUrl(fallbackUrl)
    }

    // 尝试解析并修复
    const fixedBuffer = tryRemoveNormalTextures(arrayBuffer)
    if (fixedBuffer) {
      const blob = new Blob([fixedBuffer], { type: 'model/gltf-binary' })
      setCachedBlob(modelId, blob) // 写入缓存（异步，不阻塞）
      const blobUrl = URL.createObjectURL(blob)
      console.log(`[GLB修复] 已移除法线贴图: ${modelId}`)
      return blobUrl
    }

    // 无需修复（模型本身没有法线贴图），使用原始数据构造 Blob URL
    const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' })
    setCachedBlob(modelId, blob) // 写入缓存
    return URL.createObjectURL(blob)
  } catch (err) {
    console.warn('[GLB修复] 预处理失败，尝试回退 URL:', err)
    return tryFallbackUrl(fallbackUrl)
  }
}

/** 检查回退 URL 是否可用，无效则返回 null */
function tryFallbackUrl(fallbackUrl: string): string | null {
  if (!fallbackUrl) return null
  // 接受 http(s) 绝对 URL 和 / 开头的相对路径（MinIO 迁移后 file_url 为相对路径）
  if (!fallbackUrl.startsWith('http://') && !fallbackUrl.startsWith('https://') && !fallbackUrl.startsWith('/')) {
    console.warn(`[GLB修复] 回退 URL 无效: "${fallbackUrl}"`)
    return null
  }
  return fallbackUrl
}

/**
 * 使用 ReadableStream 读取响应体，支持进度回调
 * 适用于大文件下载时实时显示加载进度
 */
async function readResponseWithProgress(
  response: Response,
  contentLength: number,
  onProgress?: (percent: number) => void,
): Promise<ArrayBuffer> {
  if (!response.body || !onProgress || !contentLength) {
    // 不支持进度跟踪时直接返回
    return response.arrayBuffer()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress(Math.round((received / contentLength) * 100))
  }

  // 合并所有 chunks
  const allChunks = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    allChunks.set(chunk, offset)
    offset += chunk.length
  }

  return allChunks.buffer
}

/** 快速验证 ArrayBuffer 是否为有效 GLB 文件（检查 magic） */
function isValidGlb(arrayBuffer: ArrayBuffer): boolean {
  if (arrayBuffer.byteLength < 20) return false
  const magic = new Uint8Array(arrayBuffer, 0, 4)
  return magic[0] === 0x67 && magic[1] === 0x6c && magic[2] === 0x54 && magic[3] === 0x46
}

/** 尝试移除 GLB 中的法线贴图，返回修复后的 ArrayBuffer；无需修复时返回 null */
function tryRemoveNormalTextures(arrayBuffer: ArrayBuffer): ArrayBuffer | null {
  if (arrayBuffer.byteLength < 20) return null

  const dataView = new DataView(arrayBuffer)

  // 验证 GLB magic: "glTF"
  const magic = new Uint8Array(arrayBuffer, 0, 4)
  if (magic[0] !== 0x67 || magic[1] !== 0x6c || magic[2] !== 0x54 || magic[3] !== 0x46) {
    return null // 不是 GLB 格式
  }

  const version = dataView.getUint32(4, true)
  if (version !== 2) return null // 只处理 GLB 2.0

  const totalLength = dataView.getUint32(8, true)
  if (totalLength !== arrayBuffer.byteLength) return null

  // 读取 JSON chunk header
  const offset = 12
  const jsonChunkLength = dataView.getUint32(offset, true)
  const jsonChunkType = dataView.getUint32(offset + 4, true)

  if (jsonChunkType !== 0x4e4f534a) {
    // 不是 JSON chunk ("JSON" = 0x4E4F534A)
    return null
  }

  // 解码 JSON
  const jsonBytes = new Uint8Array(arrayBuffer, offset + 8, jsonChunkLength)
  const jsonText = new TextDecoder().decode(jsonBytes)

  let gltf: Record<string, unknown>
  try {
    gltf = JSON.parse(jsonText)
  } catch {
    return null
  }

  // 移除导致 Cesium shader bug 的材质属性：
  // 1. normalTexture（法线贴图但无切线数据时触发 normalTexCoords 未声明）
  // 2. anisotropy 扩展（USE_ANISOTROPY + 无 HAS_BITANGENTS 时触发 computeTangent 错误）
  let modified = false
  const materials = gltf.materials as Array<Record<string, unknown>> | undefined
  if (materials && Array.isArray(materials)) {
    for (const material of materials) {
      if ('normalTexture' in material) {
        delete material.normalTexture
        modified = true
      }
      // 移除材质直接属性中的 anisotropy（glTF 2.1+ 写法）
      if ('anisotropy' in material) {
        delete material.anisotropy
        modified = true
      }
      // 移除材质 extensions 中的 KHR_materials_anisotropy（glTF 2.0 扩展写法）
      const matExt = material.extensions as Record<string, unknown> | undefined
      if (matExt && 'KHR_materials_anisotropy' in matExt) {
        delete matExt.KHR_materials_anisotropy
        modified = true
      }
    }
  }

  // 移除顶层 extensions 中的 KHR_materials_anisotropy
  const extensions = gltf.extensions as Record<string, unknown> | undefined
  if (extensions && 'KHR_materials_anisotropy' in extensions) {
    delete extensions.KHR_materials_anisotropy
    modified = true
  }

  // 移除 extensionsUsed / extensionsRequired 中的 anisotropy 引用
  for (const key of ['extensionsUsed', 'extensionsRequired'] as const) {
    const list = gltf[key] as string[] | undefined
    if (list && Array.isArray(list)) {
      const filtered = list.filter(
        (ext) => ext !== 'KHR_materials_anisotropy',
      )
      if (filtered.length !== list.length) {
        ;(gltf as Record<string, unknown>)[key] = filtered
        modified = true
      }
    }
  }

  if (!modified) return null

  // 序列化修改后的 JSON
  const newJsonText = JSON.stringify(gltf)
  const newJsonBytes = new TextEncoder().encode(newJsonText)

  // 计算 padding（4 字节对齐）
  const padding = (4 - (newJsonBytes.length % 4)) % 4
  const paddedJsonLength = newJsonBytes.length + padding

  // 原始 JSON chunk 之后的数据（BIN chunk 或后续内容）
  // 注意：原始 JSON chunk 的 chunkLength 不包含 padding，需要补齐到 4 字节对齐
  const originalJsonPadding = (4 - (jsonChunkLength % 4)) % 4
  const afterJsonOffset = offset + 8 + jsonChunkLength + originalJsonPadding
  const afterJsonBytes = new Uint8Array(arrayBuffer, afterJsonOffset)

  // 构建新的 GLB
  const newTotalLength = 12 + 8 + paddedJsonLength + afterJsonBytes.length
  const newBuffer = new ArrayBuffer(newTotalLength)
  const newView = new DataView(newBuffer)
  const newBytes = new Uint8Array(newBuffer)

  // Header
  newBytes.set(magic)
  newView.setUint32(4, version, true)
  newView.setUint32(8, newTotalLength, true)

  // JSON chunk
  const newOffset = 12
  newView.setUint32(newOffset, paddedJsonLength, true)
  newView.setUint32(newOffset + 4, jsonChunkType, true)
  newBytes.set(newJsonBytes, newOffset + 8)
  // padding with spaces (0x20)
  for (let i = newJsonBytes.length; i < paddedJsonLength; i++) {
    newBytes[newOffset + 8 + i] = 0x20
  }

  // 复制后续数据（BIN chunk 等）
  newBytes.set(afterJsonBytes, newOffset + 8 + paddedJsonLength)

  return newBuffer
}
