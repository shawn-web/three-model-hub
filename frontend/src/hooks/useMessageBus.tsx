/* eslint-disable react-refresh/only-export-components -- 本文件需同时导出 Provider 组件与单例访问器，
   二者共享同一模块级实例，拆分会破坏「React 组件与非 React 代码使用同一消息总线」的约定 */
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { MessageBus } from '../communication/message-bus'
import { parseUrlParams } from '../communication/url-params'

/** MessageBus React Context，用于在应用根部按页面生命周期管理实例 */
const MessageBusContext = createContext<MessageBus | null>(null)

/** 惰性单例实例，供非 React 代码（如 geo-store action）调用 */
let messageBusInstance: MessageBus | null = null

/**
 * 获取全局 MessageBus 实例（惰性单例，供非 React 代码使用，如 store action）
 *
 * 关键约定：此单例与 MessageBusProvider 创建的实例**必须一致**，
 * 否则 React 组件（useMessageBus）与非 React 代码（getMessageBus）
 * 在不同对象上收发消息会导致消息总线断裂。
 * 因此 MessageBusProvider 在创建实例后会同步赋值给 messageBusInstance。
 *
 * 首次创建时从 URL ?allowedOrigins= 参数读取白名单；
 * 此后可通过 messageBus.setAllowedOrigins(...) 在运行时叠加。
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
 * MessageBus Provider，在应用根部包裹，为 iframe 页面提供按生命周期管理的实例
 *
 * - mount 时从 URL ?allowedOrigins= 读取白名单并创建 MessageBus
 * - unmount 时调用 destroy() 清理（removeEventListener）
 * - StrictMode 兼容：useState 惰性初始化确保 remount 时创建新实例
 * - 与 getMessageBus() 共享同一实例，避免双实例导致消息断裂
 */
export function MessageBusProvider({ children }: { children: ReactNode }) {
  // 用 useState 惰性初始化而非 useMemo，确保 StrictMode unmount→remount 后创建新实例
  const [bus] = useState(() => {
    const params = typeof window !== 'undefined'
      ? parseUrlParams(window.location.search)
      : null
    const instance = new MessageBus({
      allowedOrigins: params?.allowedOrigins ?? null,
    })
    // 同步到全局单例，确保 getMessageBus() 返回同一实例
    messageBusInstance = instance
    return instance
  })

  useEffect(() => {
    // unmount 时销毁，移除 message 事件监听并清空全局单例引用
    return () => {
      bus.destroy()
      if (messageBusInstance === bus) {
        messageBusInstance = null
      }
    }
  }, [bus])

  return <MessageBusContext.Provider value={bus}>{children}</MessageBusContext.Provider>
}

/**
 * 从 Context 获取 MessageBus，如果不在 Provider 内则惰性创建全局实例（兼容非 iframe 场景）
 */
export function useMessageBus(): MessageBus {
  const ctx = useContext(MessageBusContext)
  if (ctx) return ctx
  // 兼容：不在 Provider 内时，回落到全局惰性单例
  return getMessageBus()
}
