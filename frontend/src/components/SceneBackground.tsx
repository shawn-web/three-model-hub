import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { BackgroundConfig } from '../store/edit-store'
import { SKYBOX_PRESETS } from '../store/edit-store'

interface SceneBackgroundProps {
  config: BackgroundConfig | null
}

/** 共用的场景背景渲染组件，供编辑器和预览页使用 */
export function SceneBackground({ config }: SceneBackgroundProps) {
  const { scene: sceneFromHook } = useThree()
  const sceneRef = useRef(sceneFromHook)
  useEffect(() => {
    sceneRef.current = sceneFromHook
  })

  const defaultColor = '#1a1a2e'
  const resolvedConfig = useMemo(
    () => config ?? { type: 'color' as const, color: defaultColor },
    [config],
  )

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
    loader.setCrossOrigin('anonymous')
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

  // 天空盒背景 URL 解析
  const skyboxUrl = useMemo(() => {
    if (resolvedConfig.type !== 'skybox') return null
    // customUrl 有实际内容时优先使用
    if (resolvedConfig.customUrl && resolvedConfig.customUrl.trim()) return resolvedConfig.customUrl.trim()
    // 否则使用预设
    const preset = SKYBOX_PRESETS.find((p) => p.id === resolvedConfig.preset)
    return preset?.url ?? SKYBOX_PRESETS[0].url
  }, [resolvedConfig])

  // 天空盒背景加载
  useEffect(() => {
    if (!skyboxUrl) return

    let disposed = false
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      skyboxUrl,
      (texture) => {
        if (disposed) { texture.dispose(); return }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.mapping = THREE.EquirectangularReflectionMapping
        sceneRef.current.background = texture
      },
      undefined,
      (error) => {
        console.error('[SceneBackground] 天空盒加载失败:', skyboxUrl, error)
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
  }, [skyboxUrl])

  return null
}
