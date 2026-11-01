 
/**
 * 共享标点精灵组件
 *
 * 供编辑模式和预览模式共用，功能：
 * - 渲染标点图标（Sprite）或回退球体
 * - 根据相机距离自适应大小
 * - 支持弹窗（通过 drei Html 组件渲染 DOM）
 * - 支持跳转链接行为
 * - 支持自定义样式：不透明度、形状裁切、偏移高度、固定大小
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { MarkerData, MarkerPopup, MarkerIframe } from '../types/edit-data'
import { getDefaultMarkerUrl } from '../utils/marker-defaults'
import { createDefaultMarkerImage } from '../utils/default-marker-image'

/** 按形状裁切纹理，返回处理后的 CanvasTexture */
function clipTexture(source: THREE.Texture, shape: string): THREE.CanvasTexture | null {
  if (shape === 'original' || !shape) return null

  const img = (source as THREE.Texture & { image?: HTMLImageElement }).image
  if (!img || !img.width || !img.height) return null

  const size = Math.max(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2

  if (shape === 'circle') {
    ctx.beginPath()
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
  } else if (shape === 'rounded') {
    const r = size * 0.15
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.lineTo(size - r, 0)
    ctx.quadraticCurveTo(size, 0, size, r)
    ctx.lineTo(size, size - r)
    ctx.quadraticCurveTo(size, size, size - r, size)
    ctx.lineTo(r, size)
    ctx.quadraticCurveTo(0, size, 0, size - r)
    ctx.lineTo(0, r)
    ctx.quadraticCurveTo(0, 0, r, 0)
    ctx.closePath()
    ctx.clip()
  }

  const dx = (size - img.width) / 2
  const dy = (size - img.height) / 2
  ctx.drawImage(img, dx, dy, img.width, img.height)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface MarkerSpriteProps {
  marker: MarkerData
  isSelected?: boolean
  onClick?: (id: string) => void
}

export function MarkerSpriteShared({ marker, isSelected, onClick }: MarkerSpriteProps) {
  const spriteRef = useRef<THREE.Sprite | THREE.Mesh>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const popupGroupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const [rawTexture, setRawTexture] = useState<THREE.Texture | null>(null)
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // 外部交互（如打开配置面板）时收起弹窗
  useEffect(() => {
    if (!isSelected) return
    const id = requestAnimationFrame(() => setExpanded(false))
    return () => cancelAnimationFrame(id)
  }, [isSelected])

  // 射线检测优先
  useEffect(() => {
    const sprite = spriteRef.current
    if (!sprite) return
    const originalRaycast = sprite.raycast.bind(sprite)
    sprite.raycast = (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) => {
      const prevLen = intersects.length
      originalRaycast(raycaster, intersects)
      for (let i = prevLen; i < intersects.length; i++) {
        intersects[i].distance -= 1
      }
    }
    return () => { sprite.raycast = originalRaycast }
  }, [rawTexture])

  // 加载原始纹理，自定义图片加载失败时回退到默认标点图标
  useEffect(() => {
    const stateImage = marker.images?.find((img) => img.state === marker.state)
    const customUrl = stateImage?.url || marker.imageUrl
    const fallbackUrl = getDefaultMarkerUrl() || createDefaultMarkerImage()
    const loader = new THREE.TextureLoader()

    const onSuccess = (tex: THREE.Texture) => {
      if (textureRef.current) textureRef.current.dispose()
      textureRef.current = tex
      tex.colorSpace = THREE.SRGBColorSpace
      setRawTexture(tex)
    }

    if (customUrl) {
      loader.load(
        customUrl,
        onSuccess,
        undefined,
        () => {
          // 自定义图片加载失败，回退到默认标点图标
          console.warn(`标点图片加载失败，回退到默认图标: ${customUrl}`)
          loader.load(fallbackUrl, onSuccess, undefined, () => setRawTexture(null))
        },
      )
    } else {
      loader.load(fallbackUrl, onSuccess, undefined, () => setRawTexture(null))
    }

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose()
        textureRef.current = null
      }
    }
  }, [marker.imageUrl, marker.state, marker.images])

  // 按形状裁切纹理（渲染阶段计算，effect cleanup 释放旧的裁切纹理）
  const displayTexture = useMemo(() => {
    if (!rawTexture) return null
    return clipTexture(rawTexture, marker.shape || 'original') || rawTexture
  }, [rawTexture, marker.shape])

  useEffect(() => {
    return () => {
      if (displayTexture && displayTexture !== rawTexture) {
        displayTexture.dispose()
      }
    }
  }, [displayTexture, rawTexture])

  // 计算不透明度（基础 × hover/selected 叠加）
  const baseOpacity = marker.opacity ?? 1
  const computedOpacity = isSelected ? baseOpacity * 0.6 : (hovered ? baseOpacity * 0.8 : baseOpacity)

  // 每帧更新位置和缩放
  useFrame(() => {
    if (!spriteRef.current) return
    const yOffset = marker.offset ?? 0
    spriteRef.current.position.set(
      marker.position[0],
      marker.position[1] + yOffset,
      marker.position[2],
    )

    if (displayTexture) {
      // sprite 使用自定义宽高
      const pos = new THREE.Vector3(marker.position[0], marker.position[1] + yOffset, marker.position[2])
      const dist = camera.position.distanceTo(pos)
      const w = (marker.width ?? 1) * 0.5
      const h = (marker.height ?? 1) * 0.5
      const screenFactor = marker.fixedSize ? 1 : dist * 0.12
      spriteRef.current.scale.set(
        Math.max(w * screenFactor, 0.001),
        Math.max(h * screenFactor, 0.001),
        1,
      )
    } else {
      // 回退球体保持较小尺寸，不随距离放大
      spriteRef.current.scale.set(1, 1, 1)
    }

    // 弹窗锚点跟随标点顶部，避免弹窗遮挡标点
    if (popupGroupRef.current) {
      const anchorPos = new THREE.Vector3(marker.position[0], marker.position[1] + yOffset, marker.position[2])
      const anchorDist = camera.position.distanceTo(anchorPos)
      const markerH = (marker.height ?? 1) * 0.5
      const markerScreenFactor = marker.fixedSize ? 1 : anchorDist * 0.12
      const spriteHeight = displayTexture ? Math.max(markerH * markerScreenFactor, 0.001) : 0.15
      popupGroupRef.current.position.set(marker.position[0], marker.position[1] + yOffset + spriteHeight, marker.position[2])
    }
  })

  const position = useMemo(
    () => new THREE.Vector3(marker.position[0], marker.position[1] + (marker.offset ?? 0), marker.position[2]) as unknown as [number, number, number],
    [marker.position, marker.offset],
  )

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (marker.action === 'popup' || marker.action === 'iframe') {
      setExpanded((prev) => !prev)
    } else if (marker.action === 'link' && marker.linkUrl) {
      window.open(marker.linkUrl, marker.linkTarget || '_blank')
    }
    onClick?.(marker.id)
  }, [marker.action, marker.linkUrl, marker.linkTarget, marker.id, onClick])

  return (
    <>
      <group renderOrder={999}>
        {displayTexture ? (
          <sprite
            ref={spriteRef}
            position={position}
            center={[0.5, 0]}
            onClick={handleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <spriteMaterial
              map={displayTexture}
              depthTest={false}
              depthWrite={false}
              opacity={computedOpacity}
              transparent
            />
          </sprite>
        ) : (
          <mesh
            ref={spriteRef}
            position={position}
            onClick={handleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshBasicMaterial color={hovered ? '#ffaa44' : '#ff4444'} depthTest={false} depthWrite={false} />
          </mesh>
        )}
      </group>

      {expanded && marker.action === 'popup' && marker.popup && (
        <group ref={popupGroupRef}>
          <Html position={[0, 0, 0]} style={{ pointerEvents: 'auto', transform: 'translate(-50%, -100%)', marginTop: '-8px', zIndex: 100 }}>
            <MarkerPopupDom popup={marker.popup} onClose={() => setExpanded(false)} />
          </Html>
        </group>
      )}

      {expanded && marker.action === 'iframe' && marker.iframe && (
        <group ref={popupGroupRef}>
          <Html position={[0, 0, 0]} style={{ pointerEvents: 'auto', transform: 'translate(-50%, -100%)', marginTop: '-8px', zIndex: 100 }}>
            <MarkerIframeDom iframe={marker.iframe} onClose={() => setExpanded(false)} />
          </Html>
        </group>
      )}
    </>
  )
}

/** 弹窗 DOM 组件，由 drei Html 包裹渲染 */
function MarkerPopupDom({ popup, onClose }: {
  popup: MarkerPopup
  onClose: () => void
}) {
  const style = popup.style
  const width = style?.width || 260
  const height = style?.height
  const bg = style?.background || 'rgba(20,20,30,0.92)'
  const textColor = style?.textColor || '#eee'
  const radius = style?.borderRadius ?? 8
  const fontSize = style?.fontSize || 13
  const padding = style?.padding ?? 0
  const borderColor = style?.borderColor
  const shadow = style?.shadow !== false
  const titleAlign = style?.titleAlign || 'left'
  const contentAlign = style?.contentAlign || 'left'

  return (
    <div style={{
      width,
      ...(height ? { height, display: 'flex', flexDirection: 'column' } : {}),
      background: bg,
      backdropFilter: 'blur(12px)',
      borderRadius: radius,
      boxShadow: shadow ? '0 4px 20px rgba(0,0,0,0.5)' : 'none',
      border: borderColor ? `1px solid ${borderColor}` : 'none',
      overflow: 'hidden',
      color: textColor,
      fontSize,
      animation: 'markerPopupIn 0.2s ease-out',
      userSelect: 'none',
    }}>
      {/* 标题栏 */}
      <div style={{
        padding,
        display: 'flex',
        alignItems: 'center',
        justifyContent: popup.title ? 'space-between' : 'flex-end',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        textAlign: titleAlign,
        flexShrink: 0,
      }}>
        {popup.title && <span style={{ fontWeight: 600, flex: 1, marginRight: 8 }}>{popup.title}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      {/* iframe 嵌入内容 */}
      {popup.contentUrl && (
        <div style={{ flex: 1, minHeight: 0, padding }}>
          <iframe
            src={popup.contentUrl}
            style={{ width: '100%', height: '100%', minHeight: height ? 0 : 200, border: 'none', borderRadius: 4, display: 'block' }}
            title={popup.title || '嵌入内容'}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )}

      {/* 文本内容 */}
      {popup.content && (
        <div style={{ padding, lineHeight: 1.6, textAlign: contentAlign, flex: 1 }}>
          {popup.content}
        </div>
      )}

      <style>{`
        @keyframes markerPopupIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/** iframe 弹窗 DOM 组件，无样式覆盖，仅 iframe + 可选关闭按钮 */
function MarkerIframeDom({ iframe, onClose }: {
  iframe: MarkerIframe
  onClose: () => void
}) {
  const width = iframe.width || 400
  const height = iframe.height || 300
  const showClose = iframe.showCloseButton !== false
  const pos = iframe.closeButtonPosition || 'top-right'

  // 关闭按钮定位到 iframe 外侧四角
  const btnOffset = 6
  const btnSize = 24
  const closePosStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 101,
    cursor: 'pointer',
    ...(pos === 'top-left' ? { top: -(btnSize + btnOffset) / 2, left: -(btnSize + btnOffset) / 2 } :
      pos === 'top-right' ? { top: -(btnSize + btnOffset) / 2, right: -(btnSize + btnOffset) / 2 } :
      pos === 'bottom-left' ? { bottom: -(btnSize + btnOffset) / 2, left: -(btnSize + btnOffset) / 2 } :
      { bottom: -(btnSize + btnOffset) / 2, right: -(btnSize + btnOffset) / 2 }),
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ width, height, overflow: 'hidden' }}>
        <iframe
          src={iframe.url}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="iframe-popup"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="fullscreen"
        />
      </div>
      {showClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          style={closePosStyle}
          title="关闭"
        >
          {iframe.closeButtonImage ? (
            <img
              src={iframe.closeButtonImage}
              alt="关闭"
              style={{ width: btnSize, height: btnSize, display: 'block' }}
            />
          ) : (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: btnSize,
              height: btnSize,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)',
              color: 'rgba(255,255,255,0.9)',
              fontSize: 14,
              lineHeight: 1,
            }}>
              &times;
            </span>
          )}
        </button>
      )}
    </div>
  )
}
