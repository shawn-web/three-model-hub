import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { removeNormalTexturesFromGlb } from '../src/utils/glb-normal-fix'

/**
 * 构造最小合法 glTF 2.0 GLB 二进制
 * 参考 spec: https://github.com/KhronosGroup/glTF/tree/main/specifications/2.0#binary-gltf-layout
 */
function buildGlb(json: object, binBytes?: Uint8Array): ArrayBuffer {
  const jsonStr = JSON.stringify(json)
  const jsonBytes = new TextEncoder().encode(jsonStr)
  // 4 字节对齐 padding（用 0x20 空格）
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4
  const paddedJsonLen = jsonBytes.length + jsonPadding

  const hasBin = !!binBytes
  const binLen = binBytes?.length ?? 0
  const binPadding = (4 - (binLen % 4)) % 4
  const paddedBinLen = binLen + binPadding

  const totalLength = 12 + 8 + paddedJsonLen + (hasBin ? 8 + paddedBinLen : 0)
  const buffer = new ArrayBuffer(totalLength)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // Header
  bytes[0] = 0x67; bytes[1] = 0x6c; bytes[2] = 0x54; bytes[3] = 0x46 // "glTF"
  view.setUint32(4, 2, true) // version
  view.setUint32(8, totalLength, true)

  // JSON chunk
  let offset = 12
  view.setUint32(offset, jsonBytes.length, true) // chunkLength (no padding)
  view.setUint32(offset + 4, 0x4e4f534a, true) // "JSON"
  bytes.set(jsonBytes, offset + 8)
  for (let i = 0; i < jsonPadding; i++) bytes[offset + 8 + jsonBytes.length + i] = 0x20
  offset += 8 + paddedJsonLen

  if (hasBin) {
    view.setUint32(offset, binLen, true)
    view.setUint32(offset + 4, 0x004e4942, true) // "BIN\0"
    bytes.set(binBytes!, offset + 8)
    for (let i = 0; i < binPadding; i++) bytes[offset + 8 + binLen + i] = 0
  }

  return buffer
}

function makeResponse(buffer: ArrayBuffer, ok = true, contentLength?: number): Response {
  const headers = new Headers()
  if (contentLength !== undefined) headers.set('Content-Length', String(contentLength))
  return new Response(buffer, { status: ok ? 200 : 500, headers })
}

describe('removeNormalTexturesFromGlb', () => {
  beforeEach(() => {
    // mock URL.createObjectURL 返回可识别 URL
    let counter = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${++counter}`)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('回退 URL 校验（tryFallbackUrl 等价行为）', () => {
    it('fallbackUrl 为空字符串时 fetch 失败应返回 null', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(new ArrayBuffer(0), false))
      const result = await removeNormalTexturesFromGlb('m1', '')
      expect(result).toBeNull()
      expect(fetchSpy).toHaveBeenCalled()
    })

    it('fallbackUrl 为相对路径（不以 http(s) 开头）时应返回 null', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(new ArrayBuffer(0), false))
      const result = await removeNormalTexturesFromGlb('m1', '/relative/path.glb')
      expect(result).toBeNull()
    })

    it('fallbackUrl 为 javascript: 伪协议时也应返回 null', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(new ArrayBuffer(0), false))
      const result = await removeNormalTexturesFromGlb('m1', 'javascript:alert(1)')
      expect(result).toBeNull()
    })

    it('fallbackUrl 为合法 http(s) URL 时应返回该 URL', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(new ArrayBuffer(0), false))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toBe('https://cdn.example.com/model.glb')
    })
  })

  describe('GLB magic 校验（isValidGlb 等价行为）', () => {
    it('后端返回 HTML 错误页（magic 不为 glTF）时应回退到 fallbackUrl', async () => {
      const htmlBuffer = new TextEncoder().encode('<html>Error</html>').buffer
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(htmlBuffer))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toBe('https://cdn.example.com/model.glb')
    })

    it('后端返回过短响应（< 20 字节）时应回退到 fallbackUrl', async () => {
      const shortBuffer = new ArrayBuffer(10)
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(shortBuffer))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toBe('https://cdn.example.com/model.glb')
    })
  })

  describe('tryRemoveNormalTextures 核心修复逻辑', () => {
    it('GLB 含 normalTexture 时应构造修复后的 blob URL', async () => {
      const glb = buildGlb({
        asset: { version: '2.0' },
        materials: [{ name: 'mat1', normalTexture: { index: 0 } }],
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(glb))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toMatch(/^blob:mock-/)
    })

    it('GLB 含 material.anisotropy（glTF 2.1+ 写法）时应移除', async () => {
      const glb = buildGlb({
        asset: { version: '2.0' },
        materials: [{ name: 'mat1', anisotropy: { strength: 0.5 } }],
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(glb))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toMatch(/^blob:mock-/)
    })

    it('GLB 含 material.extensions.KHR_materials_anisotropy 时应移除', async () => {
      const glb = buildGlb({
        asset: { version: '2.0' },
        materials: [
          { name: 'mat1', extensions: { KHR_materials_anisotropy: { anisotropy: 0.5 } } },
        ],
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(glb))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toMatch(/^blob:mock-/)
    })

    it('GLB 顶层 extensions 含 KHR_materials_anisotropy 时也应移除', async () => {
      const glb = buildGlb({
        asset: { version: '2.0' },
        extensions: { KHR_materials_anisotropy: { anisotropy: 0.5 } },
        materials: [],
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(glb))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toMatch(/^blob:mock-/)
    })

    it('extensionsUsed / extensionsRequired 应过滤 KHR_materials_anisotropy', async () => {
      const glb = buildGlb({
        asset: { version: '2.0' },
        extensionsUsed: ['KHR_materials_unlit', 'KHR_materials_anisotropy'],
        extensionsRequired: ['KHR_materials_anisotropy'],
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(glb))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toMatch(/^blob:mock-/)
    })

    it('无 normalTexture/anisotropy 的干净 GLB 仍应返回 blob URL（无需修复也走缓存路径）', async () => {
      const glb = buildGlb({
        asset: { version: '2.0' },
        materials: [{ name: 'mat1', baseColorFactor: [1, 1, 1, 1] }],
      })
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(glb))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toMatch(/^blob:mock-/)
    })
  })

  describe('网络错误', () => {
    it('fetch 抛异常时应回退到 fallbackUrl', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
      const result = await removeNormalTexturesFromGlb('m1', 'https://cdn.example.com/model.glb')
      expect(result).toBe('https://cdn.example.com/model.glb')
    })

    it('fetch 返回 5xx 且无 fallbackUrl 时应返回 null', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse(new ArrayBuffer(0), false))
      const result = await removeNormalTexturesFromGlb('m1', '')
      expect(result).toBeNull()
    })
  })
})
