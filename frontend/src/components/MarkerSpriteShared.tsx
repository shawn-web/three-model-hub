/* eslint-disable react-refresh/only-export-components */
/**
 * 共享标点精灵组件
 *
 * 供编辑模式和预览模式共用，功能：
 * - 渲染标点图标（Sprite）或回退球体
 * - 根据相机距离自适应大小
 * - 支持弹窗浮窗（通过 drei Html 组件渲染 DOM）
 * - 支持跳转链接行为
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { MarkerData, MarkerPopup } from '../types/edit-data'
import { getDefaultMarkerUrl } from '../utils/marker-defaults'

/** 生成默认标点图标（红色定位 pin）的 Data URL */
let _defaultMarkerDataUrl: string | null = null
export function createDefaultMarkerImage(): string {
  if (_defaultMarkerDataUrl) return _defaultMarkerDataUrl
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.beginPath()
  ctx.arc(32, 22, 16, Math.PI, 0, false)
  ctx.quadraticCurveTo(48, 38, 32, 56)
  ctx.quadraticCurveTo(16, 38, 16, 22)
  ctx.closePath()
  ctx.fillStyle = '#ff4444'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(32, 22, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  _defaultMarkerDataUrl = canvas.toDataURL('image/png')
  return _defaultMarkerDataUrl
}

interface MarkerSpriteProps {
  marker: MarkerData
  isSelected?: boolean
  onClick?: (id: string) => void
}

export function MarkerSpriteShared({ marker, isSelected, onClick }: MarkerSpriteProps) {
  const spriteRef = useRef<THREE.Sprite>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const { camera } = useThree()
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // 让精灵在射线检测中优先于模型
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
  }, [texture])

  // 加载纹理：优先匹配状态图片，其次用配置图标，再查自定义默认，最后用内置默认
  useEffect(() => {
    const stateImage = marker.images?.find((img) => img.state === marker.state)
    const url = stateImage?.url || marker.imageUrl || getDefaultMarkerUrl() || createDefaultMarkerImage()
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (tex) => {
        if (textureRef.current) textureRef.current.dispose()
        textureRef.current = tex
        tex.colorSpace = THREE.SRGBColorSpace
        setTexture(tex)
      },
      undefined,
      () => { setTexture(null) },
    )
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose()
        textureRef.current = null
      }
    }
  }, [marker.imageUrl, marker.state, marker.images])

  // 每帧更新精灵缩放
  useFrame(() => {
    if (spriteRef.current) {
      const pos = new THREE.Vector3(...marker.position)
      const dist = camera.position.distanceTo(pos)
      const w = (marker.width ?? 1) * 0.5
      const h = (marker.height ?? 1) * 0.5
      const screenFactor = dist * 0.12
      spriteRef.current.scale.set(
        Math.max(w * screenFactor, 0.001),
        Math.max(h * screenFactor, 0.001),
        1,
      )
    }
  })

  const position = useMemo(
    () => new THREE.Vector3(...marker.position) as unknown as [number, number, number],
    [marker.position],
  )

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (marker.action === 'popup') {
      setExpanded((prev) => !prev)
    } else if (marker.action === 'link' && marker.linkUrl) {
      window.open(marker.linkUrl, marker.linkTarget || '_blank')
    }
    onClick?.(marker.id)
  }, [marker.action, marker.linkUrl, marker.linkTarget, onClick])

  return (
    <>
      <group renderOrder={999}>
        {texture ? (
          <sprite
            ref={spriteRef}
            position={position}
            onClick={handleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <spriteMaterial map={texture} depthTest={false} depthWrite={false} opacity={isSelected ? 0.6 : (hovered ? 0.8 : 1)} transparent />
          </sprite>
        ) : (
          <mesh
            position={position}
            onClick={handleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color={hovered ? '#ffaa44' : '#ff4444'} depthTest={false} depthWrite={false} />
          </mesh>
        )}
      </group>

      {expanded && marker.action === 'popup' && marker.popup && (
        <Html position={position} style={{ pointerEvents: 'auto', transform: 'translate(-50%, calc(-100% - 24px))' }}>
          <MarkerPopupDom popup={marker.popup} onClose={() => setExpanded(false)} />
        </Html>
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
  const bg = style?.background || 'rgba(20,20,30,0.92)'
  const textColor = style?.textColor || '#eee'
  const radius = style?.borderRadius ?? 8
  const fontSize = style?.fontSize || 13

  return (
    <div style={{
      width,
      background: bg,
      backdropFilter: 'blur(12px)',
      borderRadius: radius,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      color: textColor,
      fontSize,
      animation: 'markerPopupIn 0.2s ease-out',
      userSelect: 'none',
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ fontWeight: 600, flex: 1, marginRight: 8 }}>{popup.title || '标点'}</span>
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
        <div style={{ padding: '6px 12px 0' }}>
          <iframe
            src={popup.contentUrl}
            style={{ width: '100%', height: 200, border: 'none', borderRadius: 4 }}
            title={popup.title || '嵌入内容'}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )}

      {/* 文本内容 */}
      {popup.content && (
        <div style={{ padding: '8px 12px 10px', lineHeight: 1.6 }}>
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
