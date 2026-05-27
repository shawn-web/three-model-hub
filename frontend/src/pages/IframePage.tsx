import { useEffect, useRef, useCallback, useState } from 'react'
import type { MediaClickedPayload } from '../communication/protocol'
import SceneConfig from '../assets/scene-config.js'

/**
 * Iframe 嵌入页面
 * 嵌入场景查看器并通过 postMessage 监听媒体点击等事件
 * 父页面可通过 window.addEventListener('message', ...) 自行监听以下事件：
 *   - media-clicked: { id, type, name, url?, text? }
 */

export function IframePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [events, setEvents] = useState<MediaClickedPayload[]>([])
  const configSentRef = useRef(false)
  

  setTimeout(()=>{
    SceneConfig.markers[0].imageUrl = 'https://oss.1357.cn/huazhu/labs/images/20260521/1776923671100-honaf5oeu4.jpeg'
    configSentRef.current = false
    sendConfig()
  },1000)
  setTimeout(()=>{
    SceneConfig.markers[0].imageUrl = 'http://tapp.huazhukeji.cn:32000/huazhu/labs/images/20260521/æ å»å®¤_online-pb6d2tgrk9.png'
    configSentRef.current = false
    sendConfig()
  },5000)
  // 向 iframe 发送场景配置
  const sendConfig = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || configSentRef.current) return
    configSentRef.current = true
    console.log(SceneConfig)
    const msg = { type: 'scene-config', ...SceneConfig }
    iframe.contentWindow.postMessage(msg, '*')
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    const data = event.data
    if (!data?.type) return
    if (data.type === 'media-clicked') {
      const payload = data.payload as MediaClickedPayload
      console.log(payload)
      // setEvents((prev) => [...prev.slice(-4), payload])
    }
    
    if (data.type === 'model-loaded') {
      sendConfig()
    }
  }, [sendConfig])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  return (
    <div className="w-full h-full relative">
      <iframe
        ref={iframeRef}
        className="w-full h-full"
        src="http://192.168.10.41:5173/view/ce09961a-fe82-4549-a678-f1d1206b3270"
        title="Iframe"
      />
      {/* 事件调试面板 */}
      {/* {events.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-black/80 text-white text-xs rounded-lg p-3 max-w-xs space-y-1">
          <div className="font-semibold mb-1">最近媒体点击事件：</div>
          {events.map((e, i) => (
            <div key={i} className="truncate opacity-80">
              [{e.type}] {e.name}
            </div>
          ))}
        </div>
      )} */}
    </div>
  )
}