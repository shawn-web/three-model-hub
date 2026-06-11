import type { ViewerMessage } from './protocol'
import { resolveReferrerOrigin } from './parent-origin'

/** MessageBus 构造选项 */
export interface MessageBusOptions {
  /**
   * 允许的来源 origin 白名单
   * - 不传或空数组：fallback 到 referrer origin（如果有）
   * - 传 ['*']：显式打开通配（仅测试 / 集成调试用，**生产请勿使用**）
   * - 其余：仅允许列表内 origin 收发
   */
  allowedOrigins?: string[] | null
}

/**
 * iframe 与父页面之间的 postMessage 总线
 *
 * 安全模型：
 *   - inbound：event.origin 必须在 allowlist 内，否则 drop
 *   - outbound：targetOrigin 必须在 allowlist 内；无 allowlist 且 referrer 为空时
 *     拒绝发送（warn），避免广播给任何窗口
 *   - allowlist 默认来源是 document.referrer 的 origin；调用方可通过
 *     setAllowedOrigins / 构造参数显式覆盖（典型场景是 URL 参数 allowedOrigins 或
 *     后端 config.geo.allowedOrigins）
 */
export class MessageBus {
  private handlers = new Map<string, Set<(payload: unknown) => void>>()
  /** 显式设定的 allowlist；null 表示走 referrer 默认 */
  private explicitAllowlist: string[] | null = null
  /** referrer origin 缓存（构造时解析一次） */
  private readonly referrerOrigin: string | null

  constructor(opts: MessageBusOptions = {}) {
    this.referrerOrigin = resolveReferrerOrigin()
    if (opts.allowedOrigins && opts.allowedOrigins.length > 0) {
      this.explicitAllowlist = opts.allowedOrigins
    }
    window.addEventListener('message', this.handleMessage)
  }

  /**
   * 运行时更新 allowlist（典型场景：URL 解析完成 / Geo 配置从后端拉到后）
   * 传 null 或空数组恢复为「仅 referrer」模式
   */
  setAllowedOrigins(origins: string[] | null): void {
    this.explicitAllowlist = origins && origins.length > 0 ? origins : null
  }

  /** 当前生效的 allowlist；空数组表示无任何可信 origin（应当拒绝收发） */
  private resolveAllowed(): string[] {
    if (this.explicitAllowlist) return this.explicitAllowlist
    if (this.referrerOrigin) return [this.referrerOrigin]
    return []
  }

  private isAllowedOrigin(origin: string, allowed: string[]): boolean {
    if (allowed.includes('*')) return true
    return allowed.includes(origin)
  }

  private handleMessage = (event: MessageEvent): void => {
    const allowed = this.resolveAllowed()
    if (allowed.length === 0) return
    if (!this.isAllowedOrigin(event.origin, allowed)) return

    const msg = event.data as ViewerMessage
    if (!msg?.type) return

    const handlers = this.handlers.get(msg.type)
    if (handlers) {
      handlers.forEach((handler) => handler(msg.payload))
    }
  }

  /**
   * 发送消息给父页面
   * - 指定 targetOrigin 时必须在 allowlist 内
   * - 未指定时，向所有 allowlist origin 各发一次
   * - allowlist 为空（无 referrer 且未配置）→ warn + 丢弃
   */
  send(type: string, payload: unknown, targetOrigin?: string): void {
    const allowed = this.resolveAllowed()
    if (allowed.length === 0) {
      console.warn(
        `[MessageBus] 拒绝发送 ${type}：无可信 targetOrigin（document.referrer 为空，且未配置 allowedOrigins）`,
      )
      return
    }

    const message: ViewerMessage = { type, payload }

    if (targetOrigin) {
      if (!this.isAllowedOrigin(targetOrigin, allowed)) {
        console.warn(
          `[MessageBus] 拒绝发送 ${type}：targetOrigin ${targetOrigin} 不在 allowlist [${allowed.join(', ')}]`,
        )
        return
      }
      window.parent.postMessage(message, targetOrigin)
      return
    }

    // 未指定 targetOrigin 时向所有可信 origin 发送
    // 遇 ['*'] 时退化为单次广播，保留旧测试行为
    if (allowed.length === 1 && allowed[0] === '*') {
      window.parent.postMessage(message, '*')
      return
    }
    for (const origin of allowed) {
      if (origin === '*') continue
      window.parent.postMessage(message, origin)
    }
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
