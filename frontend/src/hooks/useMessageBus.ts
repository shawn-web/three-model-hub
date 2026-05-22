import { MessageBus } from '../communication/message-bus'

let messageBusInstance: MessageBus | null = null

export function getMessageBus(): MessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus()
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
