import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { ModelLoader } from './types'
import type * as THREE from 'three'

export class GlbLoader implements ModelLoader {
  format = 'glb'
  private gltfLoader = new GLTFLoader()

  async load(url: string, onProgress?: (percent: number) => void): Promise<THREE.Group> {
    const gltf = await this.gltfLoader.loadAsync(url, (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    })

    const model = gltf.scene
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
