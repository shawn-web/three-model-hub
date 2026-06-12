import { MessageBus } from '../communication/message-bus'
import { parseUrlParams } from '../communication/url-params'

let messageBusInstance: MessageBus | null = null

/**
 * 全局 MessageBus 单例
 *
 * 首次创建时从 URL ?allowedOrigins= 参数读取白名单；
 * 之后可以通过 messageBus.setAllowedOrigins(...) 在运行时叠加（如 Geo 配置从后端拉到后）。
 */
export function getMessageBus(): MessageBus {
  if (!messageBusInstance) {
    const params = typeof window !== 'undefined'
      ? parseUrlParams(window.location.search)
      : null
    messageBusInstance = new MessageBus({
      allowedOrigins: params?.allowedOrigins ?? null,
    })
  }
  return messageBusInstance
}

/**
 * 获取全局消息总线实例
 * 直接返回单例，无需 useRef（单例天然稳定）
 */
export function useMessageBus(): MessageBus {
  return getMessageBus()
}
