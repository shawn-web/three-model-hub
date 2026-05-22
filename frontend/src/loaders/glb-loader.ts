import type { ModelLoader } from './types'
import * as THREE from 'three'
import { loadGLBWithCache } from '../utils/multi-model-loader'

export class GlbLoader implements ModelLoader {
  format = 'glb'

  async load(url: string, onProgress?: (percent: number) => void): Promise<THREE.Group> {
    // 使用共享的缓存加载函数，命中缓存时跳过网络请求
    const { scene: model, fromCache } = await loadGLBWithCache(url, onProgress
      ? (event: ProgressEvent) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100))
          } else if (event.loaded > 0) {
            onProgress(Math.min(90, Math.round((event.loaded / (event.loaded + 100000)) * 100)))
          }
        }
      : undefined,
    )

    if (fromCache) {
      console.debug(`[GlbLoader] 模型从缓存加载: ${url}`)
    }

    model.name = model.name || url.split('/').pop()?.replace('.glb', '') || 'model'
    return model
  }

  dispose(model: THREE.Group): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }
}
