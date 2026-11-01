import { describe, it, expect } from 'vitest'

/**
 * imagery-providers.ts 在模块加载时执行 import.meta.env.VITE_TIANDITU_TOKEN，
 * 因此必须在 import 之前 stub 环境变量（setup.ts 中已 stub）。
 */

// 为每个 provider 函数方法打桩，让其返回一个可识别对象

// 在调用方内部 new C.WebMapTileServiceImageryProvider / UrlTemplateImageryProvider
// 因此需要提供构造函数
class FakeWMTSProvider {
  url: string
  layer?: string
  constructor(opts: any) {
    this.url = opts.url
    this.layer = opts.layer
  }
}
class FakeUrlTemplateProvider {
  url: string
  constructor(opts: any) {
    this.url = opts.url
  }
}
class FakeCredit {
  text: string
  constructor(text: string) {
    this.text = text
  }
}

const fakeCesium = {
  WebMapTileServiceImageryProvider: FakeWMTSProvider,
  UrlTemplateImageryProvider: FakeUrlTemplateProvider,
  Credit: FakeCredit,
}

;(globalThis as any).window.Cesium = fakeCesium

import { getImageryProvider, getImageryProviderList, DEFAULT_PROVIDER_ID } from '../src/utils/imagery-providers'

describe('getImageryProvider', () => {
  it('应返回天地图配置（含 satellite/vector/terrain/annotation）', () => {
    const p = getImageryProvider('tianditu')
    expect(p.id).toBe('tianditu')
    expect(p.name).toBe('天地图')
    expect(typeof p.satellite).toBe('function')
    expect(typeof p.vector).toBe('function')
    expect(typeof p.terrain).toBe('function')
    expect(typeof p.annotation).toBe('function')
  })

  it('应返回谷歌配置', () => {
    const p = getImageryProvider('google')
    expect(p.id).toBe('google')
    expect(p.name).toBe('谷歌地图')
    expect(typeof p.satellite).toBe('function')
  })

  it('未知 providerId 应抛错', () => {
    expect(() => getImageryProvider('unknown')).toThrow(/未知的地图厂商/)
  })

  it('调用 satellite() 应通过 Cesium 构造 provider 并嵌入 token', () => {
    const p = getImageryProvider('tianditu')
    const sat = p.satellite()
    expect(sat).toBeInstanceOf(FakeWMTSProvider)
    expect(sat.url).toContain('img_w')
    expect(sat.url).toContain('tk=test-token')
  })

  it('天地图应提供 vectorOverlay（卫星模式下叠加矢量参考）', () => {
    const p = getImageryProvider('tianditu')
    expect(p.vectorOverlay).toBeDefined()
    const overlay = p.vectorOverlay!()
    expect(overlay).not.toBeNull()
    expect(overlay?.alpha).toBe(0.35)
    expect(overlay?.provider).toBeInstanceOf(FakeWMTSProvider)
  })
})

describe('getImageryProviderList', () => {
  it('应至少包含 tianditu 和 google', () => {
    const list = getImageryProviderList()
    const ids = list.map((p) => p.id)
    expect(ids).toContain('tianditu')
    expect(ids).toContain('google')
  })

  it('应返回可渲染数组（顺序稳定）', () => {
    const list = getImageryProviderList()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThanOrEqual(2)
  })
})

describe('DEFAULT_PROVIDER_ID', () => {
  it('应等于 tianditu', () => {
    expect(DEFAULT_PROVIDER_ID).toBe('tianditu')
  })
})
