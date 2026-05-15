import type { ViewerMessage } from './protocol'

export class MessageBus {
  private handlers = new Map<string, Set<(payload: unknown) => void>>()

  constructor() {
    window.addEventListener('message', this.handleMessage)
  }

  private handleMessage = (event: MessageEvent): void => {
    const msg = event.data as ViewerMessage
    if (!msg?.type) return

    const handlers = this.handlers.get(msg.type)
    if (handlers) {
      handlers.forEach((handler) => handler(msg.payload))
    }
  }

  send(type: string, payload: unknown): void {
    const message: ViewerMessage = { type, payload }
    window.parent.postMessage(message, '*')
  }

  on(type: string, handler: (payload: unknown) => void): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
  }

  off(type: string, handler: (payload: unknown) => void): void {
    this.handlers.get(type)?.delete(handler)
  }

  destroy(): void {
    window.removeEventListener('message', this.handleMessage)
    this.handlers.clear()
  }
}
