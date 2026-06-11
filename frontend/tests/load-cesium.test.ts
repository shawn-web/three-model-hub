import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * loadCesium 动态注入 <link> + <script> 并返回 Promise。
 * 测试策略：spy on document.createElement 拦截 script 元素，再手动触发 onload。
 *
 * 注意：load-cesium.ts 内部有模块级 loadingPromise 缓存。
 * 用 vi.resetModules() 在每个用例前重新导入，让 loadingPromise 归零。
 */
describe('loadCesium', () => {
  let loadCesium: typeof import('../src/utils/load-cesium').loadCesium
  let originalCesium: unknown
  let originalDefine: unknown
  let originalRequire: unknown
  let createdScripts: HTMLScriptElement[] = []
  let createdLinks: HTMLLinkElement[] = []

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../src/utils/load-cesium')
    loadCesium = mod.loadCesium

    originalCesium = (window as any).Cesium
    originalDefine = (window as any).define
    originalRequire = (window as any).require
    createdScripts = []
    createdLinks = []

    delete (window as any).Cesium
    delete (window as any).define
    delete (window as any).require

    // spy createElement 拦截 script/link 创建（不影响其他用例）
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLElement
      if (tag === 'script') createdScripts.push(el as HTMLScriptElement)
      if (tag === 'link') createdLinks.push(el as HTMLLinkElement)
      return el
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalCesium === undefined) delete (window as any).Cesium
    else (window as any).Cesium = originalCesium
    if (originalDefine === undefined) delete (window as any).define
    else (window as any).define = originalDefine
    if (originalRequire === undefined) delete (window as any).require
    else (window as any).require = originalRequire
  })

  it('首次调用应注入 <link rel=stylesheet> 与 <script src=/cesium/Cesium.js>', async () => {
    const promise = loadCesium()
    expect(createdLinks).toHaveLength(1)
    expect(createdLinks[0].rel).toBe('stylesheet')
    expect(createdLinks[0].getAttribute('href')).toBe('/cesium/Widgets/widgets.css')
    expect(createdScripts).toHaveLength(1)
    expect(createdScripts[0].getAttribute('src')).toBe('/cesium/Cesium.js')

    // 完成 promise 避免悬空
    ;(window as any).Cesium = { __stub: true }
    createdScripts[0].onload?.(new Event('load'))
    await promise
  })

  it('window.Cesium 已存在时应直接 resolve（不注入资源）', async () => {
    ;(window as any).Cesium = { __stub: true }
    const promise = loadCesium()
    await expect(promise).resolves.toBeUndefined()
    expect(createdLinks).toHaveLength(0)
    expect(createdScripts).toHaveLength(0)
  })

  it('script 加载完成且 window.Cesium 就绪时应 resolve', async () => {
    const promise = loadCesium()
    ;(window as any).Cesium = { __stub: true }
    createdScripts[0].onload?.(new Event('load'))
    await expect(promise).resolves.toBeUndefined()
  })

  it('script 加载完成但 window.Cesium 仍缺失时应 reject', async () => {
    const promise = loadCesium()
    createdScripts[0].onload?.(new Event('load'))
    try {
      await promise
      expect.fail('expected loadCesium to reject')
    } catch (e) {
      expect((e as Error).message).toMatch(/Cesium 脚本已加载但 window\.Cesium 不可用/)
    }
  })

  it('script.onerror 应 reject（Cesium 加载失败）', async () => {
    const promise = loadCesium()
    createdScripts[0].onerror?.(new Event('error'))
    try {
      await promise
      expect.fail('expected loadCesium to reject')
    } catch (e) {
      expect((e as Error).message).toMatch(/Cesium 加载失败/)
    }
  })

  it('失败后允许重试（loadingPromise 已被清空）', async () => {
    // 第一次：失败
    const p1 = loadCesium()
    expect(createdScripts).toHaveLength(1)
    createdScripts[0].onerror?.(new Event('error'))
    try {
      await p1
      expect.fail('expected first loadCesium to reject')
    } catch (e) {
      expect((e as Error).message).toMatch(/Cesium 加载失败/)
    }

    // 第二次：应重新创建 script（loadingPromise 已被清空）
    // 注意：不要提前设置 window.Cesium，否则 loadCesium 会直接 resolve 不创建 script
    const p2 = loadCesium()
    expect(createdScripts.length).toBeGreaterThanOrEqual(2)
    // 模拟第二次加载成功
    ;(window as any).Cesium = { __stub: true }
    createdScripts[1].onload?.(new Event('load'))
    await expect(p2).resolves.toBeUndefined()
  })

  it('AMD 全局变量应在加载期间被临时移除，onload 后恢复', async () => {
    ;(window as any).define = () => 'saved-define'
    ;(window as any).require = () => 'saved-require'

    const promise = loadCesium()
    // 加载期间：define/require 应被删除
    expect((window as any).define).toBeUndefined()
    expect((window as any).require).toBeUndefined()

    // 完成加载
    ;(window as any).Cesium = { __stub: true }
    createdScripts[0].onload?.(new Event('load'))
    await promise

    // 加载后：应恢复
    expect((window as any).define()).toBe('saved-define')
    expect((window as any).require()).toBe('saved-require')
  })

  it('script.onerror 后 AMD 全局变量也应恢复', async () => {
    ;(window as any).define = 'saved-define-string'
    const promise = loadCesium()
    expect((window as any).define).toBeUndefined()
    createdScripts[0].onerror?.(new Event('error'))
    try {
      await promise
      expect.fail('expected loadCesium to reject')
    } catch {
      // expected
    }
    expect((window as any).define).toBe('saved-define-string')
  })
})
