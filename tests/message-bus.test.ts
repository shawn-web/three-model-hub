import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessageBus } from '../src/communication/message-bus'

describe('MessageBus', () => {
  let bus: MessageBus

  beforeEach(() => {
    bus = new MessageBus()
  })

  afterEach(() => {
    bus.destroy()
  })

  it('should send messages to parent', () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage')
    bus.send('viewer-ready', { status: 'ok' })
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'viewer-ready', payload: { status: 'ok' } },
      '*'
    )
  })

  it('should receive messages from parent', () => {
    const handler = vi.fn()
    bus.on('load-model', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'load-model', payload: { url: 'http://example.com/model.glb' } },
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
})
