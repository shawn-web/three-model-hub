import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import type { BackgroundConfig } from '../store/edit-store'

interface SceneBackgroundProps {
  config: BackgroundConfig | null
}

/** 共用的场景背景渲染组件，供编辑器和预览页使用 */
export function SceneBackground({ config }: SceneBackgroundProps) {
  const { scene } = useThree()

  const defaultColor = '#1a1a2e'
  const resolvedConfig = config ?? { type: 'color' as const, color: defaultColor }

  // 纯色背景
  useEffect(() => {
    if (resolvedConfig.type !== 'color') return
    scene.background = new THREE.Color(resolvedConfig.color)
    scene.environment = null
    return () => { scene.background = null }
  }, [scene, resolvedConfig])

  // 图片背景
  const imageUrl = resolvedConfig.type === 'image' ? resolvedConfig.url : null
  useEffect(() => {
    if (!imageUrl) return
    const loader = new THREE.TextureLoader()
    loader.load(imageUrl, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.background = texture
    })
    return () => { scene.background = null }
  }, [scene, imageUrl])

  // 天空盒背景
  const skyboxUrls = resolvedConfig.type === 'skybox' ? resolvedConfig.urls : null
  useEffect(() => {
    if (!skyboxUrls) return
    const loader = new THREE.CubeTextureLoader()
    loader.load(skyboxUrls as string[], (cubeTexture) => {
      scene.background = cubeTexture
    })
    return () => { scene.background = null }
  }, [scene, skyboxUrls])

  // HDR 背景
  const hdrUrl = resolvedConfig.type === 'hdr' ? resolvedConfig.url : null
  useEffect(() => {
    if (!hdrUrl) return
    const loader = new RGBELoader()
    loader.load(hdrUrl, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.background = texture
      scene.environment = texture
    })
    return () => { scene.background = null; scene.environment = null }
  }, [scene, hdrUrl])

  return null
}
