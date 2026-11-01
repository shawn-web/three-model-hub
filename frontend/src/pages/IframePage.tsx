import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { MESSAGE_TYPES } from '../communication/protocol'
import type { MediaClickedPayload } from '../communication/protocol'
import { useMessageBus } from '../hooks/useMessageBus'
import { parseUrlParams } from '../communication/url-params'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - .js 配置文件无类型声明
import SceneConfig from '../assets/scene-config.js'

/**
 * Iframe 嵌入页面
 * 嵌入场景查看器并通过 postMessage 监听媒体点击等事件
 * 父页面可通过 window.addEventListener('message', ...) 自行监听以下事件：
 *   - media-clicked: { id, type, name, url?, text? }
 *
 * 安全说明：
 *   - iframe src 使用相对路径，不再硬编码域名
 *   - postMessage 的 targetOrigin 从配置读取，无配置时不发送（拒绝通配 '*'）
 *   - 子 iframe 的事件监听走 MessageBus，由其 allowlist 统一校验 origin
 */
export function IframePage() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const [searchParams] = useSearchParams()
  const messageBus = useMessageBus()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 从 URL 参数解析 allowedOrigins，用于 postMessage targetOrigin 和 MessageBus allowlist（useMemo 避免每次 render 重新解析）
  const urlParams = useMemo(() => parseUrlParams(window.location.search), [])

  // 向子 iframe 发送场景配置（targetOrigin 从配置读取，无配置时不发）
  const sendConfig = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !sceneId) return
    // targetOrigin 优先使用 URL 参数白名单，回退到当前同源 origin
    const targetOrigin = urlParams.allowedOrigins?.[0] || window.location.origin
    if (!targetOrigin) return
    const msg = { type: MESSAGE_TYPES.SCENE_CONFIG, ...SceneConfig }
    iframe.contentWindow.postMessage(msg, targetOrigin)
  }, [sceneId, urlParams.allowedOrigins])

  // 监听子 iframe 事件（origin 校验由 MessageBus allowlist 统一处理）
  useEffect(() => {
    // 设置 allowlist：子 iframe 同源，允许当前 origin 收发
    const currentOrigin = window.location.origin
    const origins = urlParams.allowedOrigins
      ? [...new Set([currentOrigin, ...urlParams.allowedOrigins])]
      : [currentOrigin]
    messageBus.setAllowedOrigins(origins)

    // 媒体点击事件转发
    const handleMediaClicked = (payload: unknown) => {
      const data = payload as MediaClickedPayload
      console.log(data)
    }
    messageBus.on(MESSAGE_TYPES.MEDIA_CLICKED, handleMediaClicked)

    // 子 iframe 就绪后发送场景配置（替代旧的 model-loaded 触发）
    const handleViewerReady = () => {
      sendConfig()
    }
    messageBus.on(MESSAGE_TYPES.VIEWER_READY, handleViewerReady)

    return () => {
      messageBus.off(MESSAGE_TYPES.MEDIA_CLICKED, handleMediaClicked)
      messageBus.off(MESSAGE_TYPES.VIEWER_READY, handleViewerReady)
      // 卸载时还原 allowlist，避免污染其他页面
      messageBus.setAllowedOrigins(null)
    }
  }, [messageBus, urlParams.allowedOrigins, sendConfig])

  // searchParams 触发 urlParams 重算（保持响应式）
  void searchParams

  if (!sceneId) return null

  return (
    <div className="w-full h-full relative">
      <iframe
        ref={iframeRef}
        className="w-full h-full"
        src={`/view/${sceneId}?allowedOrigins=${encodeURIComponent(window.location.origin)}`}
        title="Iframe"
      />
    </div>
  )
}