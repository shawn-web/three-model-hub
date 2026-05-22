import { useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { BackgroundConfig } from '../store/edit-store'

interface SceneBackgroundProps {
  config: BackgroundConfig | null
}

/** 生成天空盒渐变纹理（Canvas 绘制蓝色到白色渐变） */
function createSkyGradientTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, '#0077ff')
  gradient.addColorStop(0.4, '#4499ff')
  gradient.addColorStop(0.7, '#88bbff')
  gradient.addColorStop(1, '#ffffff')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** 天空盒渐变纹理（单例复用） */
let _skyTexture: THREE.Texture | null = null
function getSkyTexture(): THREE.Texture {
  if (!_skyTexture) {
    _skyTexture = createSkyGradientTexture()
  }
  return _skyTexture
}

/** 共用的场景背景渲染组件，供编辑器和预览页使用 */
export function SceneBackground({ config }: SceneBackgroundProps) {
  const { scene: sceneFromHook } = useThree()
  const sceneRef = useRef(sceneFromHook)
  // 在 effect 中同步 ref，避免在渲染中修改 ref
  useEffect(() => {
    sceneRef.current = sceneFromHook
  })

  const defaultColor = '#1a1a2e'
  const resolvedConfig = useMemo(
    () => config ?? { type: 'color' as const, color: defaultColor },
    [config],
  )

  const isSkybox = resolvedConfig.type === 'skybox'

  // 天空盒模式下持续确保 scene.background 为渐变纹理
  useFrame(() => {
    if (isSkybox) {
      const skyTex = getSkyTexture()
      const scene = sceneRef.current
      if (scene.background !== skyTex) {
        scene.background = skyTex
      }
    }
  })

  // 纯色背景
  useEffect(() => {
    if (resolvedConfig.type !== 'color') return
    const scene = sceneRef.current
    scene.background = new THREE.Color(resolvedConfig.color)
    return () => { scene.background = null }
  }, [resolvedConfig])

  // 图片背景
  const imageUrl = resolvedConfig.type === 'image' ? resolvedConfig.url : null
  useEffect(() => {
    if (!imageUrl) return

    let disposed = false
    const loader = new THREE.TextureLoader()
    loader.load(
      imageUrl,
      (texture) => {
        if (disposed) { texture.dispose(); return }
        texture.colorSpace = THREE.SRGBColorSpace
        sceneRef.current.background = texture
      },
      undefined,
      (error) => {
        console.error('[SceneBackground] 背景图片加载失败:', error)
        sceneRef.current.background = new THREE.Color(defaultColor)
      },
    )

    return () => {
      disposed = true
      const bg = sceneRef.current.background
      if (bg && bg instanceof THREE.Texture) {
        bg.dispose()
      }
      sceneRef.current.background = null
    }
  }, [imageUrl])

  // 天空盒：设置渐变纹理为场景背景
  useEffect(() => {
    if (!isSkybox) return
    sceneRef.current.background = getSkyTexture()
    return () => { sceneRef.current.background = null }
  }, [isSkybox])

  return null
}
