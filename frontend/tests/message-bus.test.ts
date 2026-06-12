import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessageBus } from '../src/communication/message-bus'

/**
 * MessageBus 单元测试
 *
 * 新安全模型：
 *   - 没有显式 allowedOrigins 且 referrer 为空时，inbound/outbound 都拒绝
 *   - 显式 allowedOrigins=['*'] 才会广播（仅测试 / 调试用）
 *   - 校验仅在 event.origin 和 targetOrigin 上做，handler 注册/取消行为不变
 */
describe('MessageBus', () => {
  let bus: MessageBus
  let postMessageSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // 显式开通配，保留原有 send/receive 行为以便复用旧测试
    bus = new MessageBus({ allowedOrigins: ['*'] })
    postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    bus.destroy()
    postMessageSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('should send messages to parent (wildcard allowlist)', () => {
    bus.send('viewer-ready', { status: 'ok' })
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'viewer-ready', payload: { status: 'ok' } },
      '*'
    )
  })

  it('should receive messages from parent (wildcard allowlist)', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: { url: 'http://example.com/model.glb' } },
        origin: 'http://attacker.example.com',
      })
    )

    expect(handler).toHaveBeenCalledWith({ url: 'http://example.com/model.glb' })
  })

  it('should unsubscribe handlers', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)
    bus.off('load-model', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: { url: 'http://example.com/model.glb' } },
      })
    )

    expect(handler).not.toHaveBeenCalled()
  })

  it('should ignore messages without type', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { payload: { url: 'test' } },
      })
    )

    expect(handler).not.toHaveBeenCalled()
  })

  it('should clean up listener on destroy', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)
    bus.destroy()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: { url: 'test' } },
      })
    )

    expect(handler).not.toHaveBeenCalled()
  })

  // ── 扩展用例：覆盖 send 签名、Set 去重、多 handler ───────

  it('send 显式传入 targetOrigin 时应使用传入值', () => {
    bus.setAllowedOrigins(['https://parent.example.com'])
    bus.send('geo-config', { foo: 1 }, 'https://parent.example.com')
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'geo-config', payload: { foo: 1 } },
      'https://parent.example.com'
    )
  })

  it('同 type 多个 handler 应全部触发', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('geo-models-loaded', h1)
    bus.on('geo-models-loaded', h2)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'geo-models-loaded', payload: { mapId: 'm1' } },
      })
    )

    expect(h1).toHaveBeenCalledWith({ mapId: 'm1' })
    expect(h2).toHaveBeenCalledWith({ mapId: 'm1' })
  })

  it('不同 type 的 handler 互不干扰', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('geo-ready', h1)
    bus.on('geo-saved', h2)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'geo-ready', payload: { v: 1 } },
      })
    )

    expect(h1).toHaveBeenCalledWith({ v: 1 })
    expect(h2).not.toHaveBeenCalled()
  })

  it('同 handler 多次 on 应只触发一次（Set 去重）', () => {
    const h = vi.fn()
    bus.on('geo-ready', h)
    bus.on('geo-ready', h) // 重复订阅

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'geo-ready', payload: {} },
      })
    )

    expect(h).toHaveBeenCalledTimes(1)
  })

  it('off 仅解绑指定 handler，不影响其他订阅者', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('geo-ready', h1)
    bus.on('geo-ready', h2)
    bus.off('geo-ready', h1)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'geo-ready', payload: {} },
      })
    )

    expect(h1).not.toHaveBeenCalled()
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('destroy 后 send 仍可调用（不重建 listener）', () => {
    bus.destroy()
    // 销毁后 send 不会报错；postMessage 依然会被 window.parent 接收
    expect(() => bus.send('geo-ready', {})).not.toThrow()
    // handlers 已被清空，因此不会有内部 handler 异常
  })

  it('payload 为 null 时仍能正常分发', () => {
    const h = vi.fn()
    bus.on('geo-ready', h)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'geo-ready', payload: null },
      })
    )

    expect(h).toHaveBeenCalledWith(null)
  })
})

// ── origin 校验 ─────────────────────────────────────────

describe('MessageBus origin 校验', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    postMessageSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('无 referrer 且无 allowedOrigins → inbound drop', () => {
    const bus = new MessageBus()
    const handler = vi.fn()
    bus.on('load-model', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: {} },
        origin: 'https://anyone.example.com',
      })
    )

    expect(handler).not.toHaveBeenCalled()
    bus.destroy()
  })

  it('无 referrer 且无 allowedOrigins → outbound 拒绝 + warn', () => {
    const bus = new MessageBus()
    bus.send('geo-ready', { mapId: 'm1' })
    expect(postMessageSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('拒绝发送 geo-ready'),
    )
    bus.destroy()
  })

  it('显式 allowedOrigins → 仅列表内 origin 可入', () => {
    const bus = new MessageBus({ allowedOrigins: ['https://trusted.example.com'] })
    const handler = vi.fn()
    bus.on('load-model', handler)

    // 不在白名单
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: {} },
        origin: 'https://attacker.example.com',
      })
    )
    expect(handler).not.toHaveBeenCalled()

    // 在白名单
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: { ok: 1 } },
        origin: 'https://trusted.example.com',
      })
    )
    expect(handler).toHaveBeenCalledWith({ ok: 1 })
    bus.destroy()
  })

  it('显式 allowedOrigins → 指定 targetOrigin 不在列表时拒绝发送', () => {
    const bus = new MessageBus({ allowedOrigins: ['https://trusted.example.com'] })
    bus.send('geo-ready', {}, 'https://attacker.example.com')
    expect(postMessageSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('不在 allowlist'),
    )
    bus.destroy()
  })

  it('未指定 targetOrigin 时向所有 allowlist origin 各发一次', () => {
    const bus = new MessageBus({
      allowedOrigins: ['https://a.example.com', 'https://b.example.com'],
    })
    bus.send('geo-saved', { mapId: 'm1' })
    expect(postMessageSpy).toHaveBeenCalledTimes(2)
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'geo-saved' }),
      'https://a.example.com',
    )
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'geo-saved' }),
      'https://b.example.com',
    )
    bus.destroy()
  })

  it('setAllowedOrigins(null) → 恢复 referrer 默认模式', () => {
    const bus = new MessageBus({ allowedOrigins: ['https://a.example.com'] })
    bus.setAllowedOrigins(null)
    // 此时 referrer 为空（test 环境），inbound 应 drop
    const handler = vi.fn()
    bus.on('load-model', handler)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: {} },
        origin: 'https://a.example.com',
      })
    )
    expect(handler).not.toHaveBeenCalled()
    bus.destroy()
  })
})
