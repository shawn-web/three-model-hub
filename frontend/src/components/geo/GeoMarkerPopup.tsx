/**
 * Geo 标点/模型弹窗组件
 * 使用 HTML overlay 覆盖在 Cesium canvas 上方
 * 通过 postRender + SceneTransforms.wgs84ToWindowCoordinates 跟踪屏幕位置
 */
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useGeoStore } from '../../store/geo-store'
import { getEffectiveGeo } from '../../store/geo-store'
import type { GeoMarkerPopup as GeoMarkerPopupData, GeoMarkerPopupStyle, GeoMarkerIframe } from '../../types/geo-marker'

import { getCs } from '../../utils/cesium-instance'

/** 默认弹窗样式 */
const DEFAULT_STYLE: Required<GeoMarkerPopupStyle> = {
  width: 280,
  height: 0, // 0 = 自适应
  background: 'rgba(20, 20, 30, 0.92)',
  textColor: '#eee',
  borderRadius: 10,
  fontSize: 13,
  padding: 12,
  borderColor: 'rgba(100, 160, 255, 0.3)',
  shadow: true,
  titleAlign: 'left',
  contentAlign: 'left',
}

interface GeoMarkerPopupProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any
}

export function GeoMarkerPopup({ viewer }: GeoMarkerPopupProps) {
  const activePopupTarget = useGeoStore((s) => s.activePopupTarget)
  const markers = useGeoStore((s) => s.markers)
  const models = useGeoStore((s) => s.models)
  const setActivePopupTarget = useGeoStore((s) => s.setActivePopupTarget)

  const containerRef = useRef<HTMLDivElement>(null)

  // 从 store 数据计算弹窗信息和位置（纯函数，不访问 ref）
  const popupResult = useMemo(() => {
    if (!activePopupTarget) return null

    if (activePopupTarget.type === 'marker') {
      const marker = markers.find((m) => m.id === activePopupTarget.id)
      if (!marker || marker.action === 'none') return null

      const position = { lng: marker.longitude, lat: marker.latitude, alt: marker.altitude }

      if (marker.action === 'popup' && marker.popup) {
        return { type: 'popup' as const, data: marker.popup, position }
      }
      if (marker.action === 'iframe' && marker.iframe) {
        return { type: 'iframe' as const, data: marker.iframe, position }
      }
      if (marker.action === 'link' && marker.linkUrl) {
        return { type: 'link' as const, url: marker.linkUrl, target: marker.linkTarget || '_blank', position }
      }
      return null
    }

    if (activePopupTarget.type === 'model') {
      const model = models.find((m) => m.id === activePopupTarget.id)
      if (!model) return null

      const geo = getEffectiveGeo(model)
      if (!geo) return null

      const position = { lng: geo.longitude, lat: geo.latitude, alt: geo.altitude }

      return {
        type: 'popup' as const,
        data: {
          title: model.display_name || model.modelName,
          content: `模型 ID: ${model.model_id}`,
          imageUrl: model.thumbnailUrl || undefined,
        } as GeoMarkerPopupData,
        position,
      }
    }

    return null
  }, [activePopupTarget, markers, models])

  // link 类型直接跳转，不需要渲染弹窗
  useEffect(() => {
    if (popupResult?.type === 'link') {
      window.open(popupResult.url, popupResult.target)
      setActivePopupTarget(null)
    }
  }, [popupResult, setActivePopupTarget])

  // 位置跟踪：通过 postRender 直接操作 DOM 避免每帧 React 重渲染
  useEffect(() => {
    if (!viewer || !popupResult || popupResult.type === 'link' || !popupResult.position) {
      if (containerRef.current) {
        containerRef.current.style.display = 'none'
      }
      return
    }

    const C = getCs()
    const cesiumPos = C.Cartesian3.fromDegrees(
      popupResult.position.lng,
      popupResult.position.lat,
      popupResult.position.alt,
    )

    const updatePosition = () => {
      if (!containerRef.current) return
      // Cesium 1.107+ 改名为 worldToWindowCoordinates，旧版为 wgs84ToWindowCoordinates
      const toWindow = C.SceneTransforms.worldToWindowCoordinates
        || C.SceneTransforms.wgs84ToWindowCoordinates
      const canvasPos = toWindow.call(C.SceneTransforms, viewer.scene, cesiumPos)
      if (canvasPos) {
        containerRef.current.style.display = 'block'
        containerRef.current.style.left = `${canvasPos.x}px`
        containerRef.current.style.top = `${canvasPos.y - 10}px`
      } else {
        containerRef.current.style.display = 'none'
      }
    }

    viewer.scene.postRender.addEventListener(updatePosition)
    updatePosition()

    return () => {
      viewer.scene.postRender.removeEventListener(updatePosition)
    }
  }, [viewer, popupResult])

  // 关闭弹窗
  const handleClose = useCallback(() => {
    setActivePopupTarget(null)
  }, [setActivePopupTarget])

  if (!popupResult || popupResult.type === 'link') return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        transform: 'translate(-50%, -100%)',
        zIndex: 50,
        pointerEvents: 'auto',
        display: 'none',
      }}
    >
      {popupResult.type === 'popup' && (
        <PopupCard popup={popupResult.data} onClose={handleClose} />
      )}
      {popupResult.type === 'iframe' && (
        <IframeCard iframe={popupResult.data} onClose={handleClose} />
      )}
    </div>
  )
}

/** 富文本弹窗卡片 */
function PopupCard({
  popup,
  onClose,
}: {
  popup: GeoMarkerPopupData
  onClose: () => void
}) {
  const style = { ...DEFAULT_STYLE, ...popup.style }

  return (
    <div
      style={{
        width: style.width,
        minHeight: style.height || undefined,
        background: style.background,
        color: style.textColor,
        borderRadius: style.borderRadius,
        padding: style.padding,
        fontSize: style.fontSize,
        border: style.borderColor ? `1px solid ${style.borderColor}` : undefined,
        boxShadow: style.shadow ? '0 4px 20px rgba(0,0,0,0.5)' : undefined,
        position: 'relative',
        maxWidth: '90vw',
      }}
    >
      {/* 关闭按钮 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          color: style.textColor,
          opacity: 0.6,
        }}
      >
        ✕
      </div>

      {/* 标题 */}
      {popup.title && (
        <div
          style={{
            fontWeight: 600,
            fontSize: style.fontSize + 2,
            marginBottom: 6,
            textAlign: style.titleAlign,
            paddingRight: 20,
          }}
        >
          {popup.title}
        </div>
      )}

      {/* 图片 */}
      {popup.imageUrl && (
        <div style={{ marginBottom: 8 }}>
          <img
            src={popup.imageUrl}
            alt=""
            style={{
              width: '100%',
              borderRadius: style.borderRadius - 2,
              maxHeight: 180,
              objectFit: 'cover',
            }}
          />
        </div>
      )}

      {/* 正文 */}
      {popup.content && (
        <div
          style={{
            textAlign: style.contentAlign,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {popup.content}
        </div>
      )}

      {/* 内容 iframe */}
      {popup.contentUrl && (
        <iframe
          src={popup.contentUrl}
          style={{
            width: '100%',
            height: 150,
            border: 'none',
            borderRadius: style.borderRadius - 2,
            marginTop: 8,
          }}
        />
      )}

      {/* 跳转链接 */}
      {popup.linkUrl && (
        <a
          href={popup.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 8,
            color: '#6ea8fe',
            fontSize: style.fontSize - 1,
            textDecoration: 'none',
          }}
        >
          查看详情 →
        </a>
      )}

      {/* 底部三角箭头 */}
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: `8px solid ${style.background}`,
        }}
      />
    </div>
  )
}

/** iframe 弹窗卡片 */
function IframeCard({
  iframe,
  onClose,
}: {
  iframe: GeoMarkerIframe
  onClose: () => void
}) {
  const width = iframe.width || 400
  const height = iframe.height || 300

  return (
    <div
      style={{
        position: 'relative',
        background: 'rgba(20, 20, 30, 0.95)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        border: '1px solid rgba(100, 160, 255, 0.3)',
        maxWidth: '90vw',
        maxHeight: '80vh',
      }}
    >
      {/* 关闭按钮 */}
      {(iframe.showCloseButton !== false) && (
        <div
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            color: '#eee',
            opacity: 0.6,
            zIndex: 1,
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 4,
            padding: '2px 6px',
          }}
        >
          ✕
        </div>
      )}

      <iframe
        src={iframe.url}
        style={{
          width,
          height,
          border: 'none',
          display: 'block',
        }}
      />

      {/* 底部三角箭头 */}
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid rgba(20, 20, 30, 0.95)',
        }}
      />
    </div>
  )
}
