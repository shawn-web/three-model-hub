/**
 * 场景媒体 3D 渲染组件
 *
 * 支持 image/video/text 三种类型，
 * billboard（广告牌）和 embed（嵌入场景）两种朝向模式。
 */
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneMedia } from '../types/edit-data'

/** 旧数据兼容：单数字视为 Z 轴旋转 */
function normalizeRotation(r: unknown): [number, number, number] {
  if (Array.isArray(r)) return [r[0] ?? 0, r[1] ?? 0, r[2] ?? 0]
  if (typeof r === 'number') return [0, 0, r]
  return [0, 0, 0]
}

const POS_ZERO: [number, number, number] = [0, 0, 0]

/** 图片/视频媒体渲染（向后兼容别名） */
export function SceneImageSprite({ image, onClick }: { image: SceneMedia; onClick?: (id: string) => void }) {
  return <SceneMediaSprite media={image} onClick={onClick} />
}

/** 通用媒体渲染 */
function SceneMediaSprite({ media, onClick }: { media: SceneMedia; onClick?: (id: string) => void }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const vec3Cache = useRef(new THREE.Vector3())
  const { camera } = useThree()
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [loadError, setLoadError] = useState(() => {
    if (media.type === 'image' && !media.url) return true
    if (media.type === 'video' && !media.url) return true
    return false
  })

  const isBillboard = media.billboard !== false
  const rot = useMemo(() => normalizeRotation(media.rotation), [media.rotation])

  // 文字标注渲染（渲染阶段计算，effect cleanup 释放旧纹理）
  const textTexture = useMemo(() => {
    if (media.type !== 'text') return null
    const canvas = document.createElement('canvas')
    const fontSize = media.fontSize || 24
    const text = media.text || ''
    const ctx = canvas.getContext('2d')!
    ctx.font = `bold ${fontSize}px sans-serif`
    const metrics = ctx.measureText(text)
    const padding = 12
    canvas.width = Math.ceil(metrics.width) + padding * 2
    canvas.height = fontSize + padding * 2
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = media.fontColor || '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [media.type, media.text, media.fontSize, media.fontColor])

  useEffect(() => {
    return () => {
      if (textTexture) textTexture.dispose()
    }
  }, [textTexture])

  // 图片纹理加载
  useEffect(() => {
    if (media.type !== 'image') return
    if (!media.url) return

    const loader = new THREE.TextureLoader()
    loader.load(
      media.url,
      (tex) => {
        if (textureRef.current) textureRef.current.dispose()
        textureRef.current = tex
        tex.colorSpace = THREE.SRGBColorSpace
        setTexture(tex)
        setLoadError(false)
      },
      undefined,
      () => {
        setTexture(null)
        setLoadError(true)
      },
    )

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose()
        textureRef.current = null
      }
    }
  }, [media.type, media.url])

  // 视频纹理：创建/销毁只依赖 url
  useEffect(() => {
    if (media.type !== 'video') return
    if (!media.url) return

    const video = document.createElement('video')
    video.src = media.url
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = media.muted !== false
    video.loop = media.loop !== false

    videoRef.current = video

    const tex = new THREE.VideoTexture(video)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    textureRef.current = tex

    video.addEventListener('loadeddata', () => {
      setTexture(tex)
      setLoadError(false)
      if (media.autoplay !== false) {
        video.play().catch(() => {})
      }
    })
    video.addEventListener('error', () => {
      setTexture(null)
      setLoadError(true)
    })

    return () => {
      video.pause()
      video.src = ''
      video.load()
      if (textureRef.current) {
        textureRef.current.dispose()
        textureRef.current = null
      }
      videoRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 视频属性由独立 effect 响应式更新，避免重建 video 元素
  }, [media.type, media.url])

  // 视频属性响应式更新（不重建 video 元素）
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = media.muted !== false
    video.loop = media.loop !== false
  }, [media.muted, media.loop])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (media.autoplay !== false && video.paused && video.readyState >= 2) {
      video.play().catch(() => {})
    }
  }, [media.autoplay])

  // 宽高比
  const aspect = useMemo(() => {
    if (media.type === 'text' && textTexture) {
      return textTexture.image.width / textTexture.image.height
    }
    if (!media.width || !media.height) return 1
    return media.width / media.height
  }, [media.type, media.width, media.height, textTexture])

  const activeTexture = media.type === 'text' ? textTexture : texture

  // 每帧更新
  useFrame(() => {
    if (!meshRef.current) return

    const pos = media.position ?? POS_ZERO
    meshRef.current.position.set(pos[0], pos[1], pos[2])

    const userScaleX = media.scale?.[0] ?? 1
    const userScaleY = media.scale?.[1] ?? 1

    if (isBillboard) {
      meshRef.current.lookAt(camera.position)
      // lookAt 后叠加用户 Z 轴面内旋转
      if (rot[2] !== 0) meshRef.current.rotateZ(rot[2])
      // distance-based scaling
      vec3Cache.current.set(pos[0], pos[1], pos[2])
      const dist = camera.position.distanceTo(vec3Cache.current)
      const screenFactor = Math.max(dist * 0.12, 0.5)
      const w = aspect >= 1 ? screenFactor : screenFactor * aspect
      const h = aspect >= 1 ? screenFactor / aspect : screenFactor
      meshRef.current.scale.set(w * userScaleX, h * userScaleY, 1)
    } else {
      meshRef.current.rotation.set(rot[0], rot[1], rot[2])
      const w = aspect >= 1 ? 1 : aspect
      const h = aspect >= 1 ? 1 / aspect : 1
      meshRef.current.scale.set(w * userScaleX, h * userScaleY, 1)
    }
  })

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick?.(media.id)
  }, [media.id, onClick])

  if (!media.visible) return null

  const position = (media.position ?? POS_ZERO) as [number, number, number]

  return (
    <mesh
      ref={meshRef}
      renderOrder={isBillboard ? 999 : 0}
      position={position}
      onClick={handleClick}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={activeTexture || undefined}
        color={activeTexture ? '#ffffff' : loadError ? '#ff4444' : '#4a9eff'}
        opacity={activeTexture ? 1 : 0.4}
        transparent
        depthTest={!isBillboard}
        depthWrite={!isBillboard}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
