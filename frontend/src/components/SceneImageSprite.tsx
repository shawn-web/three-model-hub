/**
 * 场景媒体 3D 渲染组件
 *
 * 支持 image/video/text/iframe 四种类型，
 * billboard（广告牌）和 embed（嵌入场景）两种朝向模式。
 */
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { SceneMedia } from '../types/edit-data'

interface SceneMediaSpriteProps {
  media: SceneMedia
  onClick?: (id: string) => void
}

/** 图片/视频媒体渲染 */
export function SceneImageSprite({ image, onClick }: { image: SceneMedia; onClick?: (id: string) => void }) {
  return <SceneMediaSprite media={image} onClick={onClick} />
}

/** 通用媒体渲染 */
function SceneMediaSprite({ media, onClick }: SceneMediaSpriteProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const { camera } = useThree()
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  // 判断初始加载错误状态：图片/视频类型但缺少 url 时直接标记为错误
  const [loadError, setLoadError] = useState(() => {
    if (media.type === 'image' && !media.url) return true
    if (media.type === 'video' && !media.url) return true
    return false
  })

  const isBillboard = media.billboard !== false

  // 文字标注渲染
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

  // 视频纹理加载
  useEffect(() => {
    if (media.type !== 'video') return
    if (!media.url) return

    const video = document.createElement('video')
    video.src = media.url
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = true
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
      // 先以静音模式播放，确保浏览器允许自动播放
      if (media.autoplay !== false) {
        video.play().then(() => {
          // 播放成功后应用用户的静音设置
          if (media.muted === false) {
            video.muted = false
          }
        }).catch(() => {
          // 静音播放失败（极少发生），直接忽略
        })
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
  }, [media.type, media.url, media.autoplay, media.muted, media.loop])

  // 宽高比
  const aspect = useMemo(() => {
    if (media.type === 'text' && textTexture) {
      return textTexture.image.width / textTexture.image.height
    }
    if (!media.width || !media.height) return 1
    return media.width / media.height
  }, [media.type, media.width, media.height, textTexture])

  // 获取当前活跃纹理
  const activeTexture = media.type === 'text' ? textTexture : texture

  // 每帧更新
  useFrame(() => {
    if (!meshRef.current) return

    const pos = media.position || [0, 0, 0]
    meshRef.current.position.set(pos[0], pos[1], pos[2])

    const userScaleX = media.scale?.[0] ?? 1
    const userScaleY = media.scale?.[1] ?? 1

    if (isBillboard) {
      meshRef.current.lookAt(camera.position)
      const imgPos = new THREE.Vector3(pos[0], pos[1], pos[2])
      const dist = camera.position.distanceTo(imgPos)
      const screenFactor = Math.max(dist * 0.12, 0.5)
      const w = aspect >= 1 ? screenFactor : screenFactor * aspect
      const h = aspect >= 1 ? screenFactor / aspect : screenFactor
      meshRef.current.scale.set(w * userScaleX, h * userScaleY, 1)
    } else {
      const rot = typeof media.rotation === 'number' ? media.rotation : 0
      meshRef.current.rotation.set(0, 0, rot)
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

  const position = (media.position || [0, 0, 0]) as [number, number, number]

  // iframe 类型用 Html 渲染
  if (media.type === 'iframe' && media.iframeUrl) {
    return <IframeSprite media={media} />
  }

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

/** iframe 媒体渲染：使用 Html 在 3D 空间中嵌入真实 iframe */
function IframeSprite({ media }: { media: SceneMedia }) {
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const isBillboard = media.billboard !== false
  const iframeWidth = media.width || 512
  const iframeHeight = media.height || 384

  useFrame(() => {
    if (!groupRef.current) return
    const pos = media.position || [0, 0, 0]
    groupRef.current.position.set(pos[0], pos[1], pos[2])

    if (isBillboard) {
      groupRef.current.lookAt(camera.position)
    } else {
      const rot = typeof media.rotation === 'number' ? media.rotation : 0
      groupRef.current.rotation.set(0, 0, rot)
    }
  })

  if (!media.visible) return null

  const position = (media.position || [0, 0, 0]) as [number, number, number]

  // 计算iframe的CSS尺寸，根据距离缩放
  const userScaleX = media.scale?.[0] ?? 1
  const userScaleY = media.scale?.[1] ?? 1

  return (
    <group ref={groupRef} position={position}>
      {/* 用于射线检测的隐形平面 */}
      <mesh renderOrder={isBillboard ? 999 : 0}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html
        center
        distanceFactor={isBillboard ? undefined : 10}
        style={{
          width: iframeWidth * userScaleX,
          height: iframeHeight * userScaleY,
          pointerEvents: 'auto',
          overflow: 'hidden',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.15)',
        }}
        zIndexRange={[999, 0]}
      >
        <iframe
          src={media.iframeUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: 4,
            background: '#fff',
          }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title="嵌入网页"
        />
      </Html>
    </group>
  )
}
