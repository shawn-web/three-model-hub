import type * as THREE from 'three'

export interface ModelLoader {
  format: string
  load(url: string, onProgress?: (percent: number) => void): Promise<THREE.Group>
  dispose(model: THREE.Group): void
}

export interface LoaderRegistry {
  register(loader: ModelLoader): void
  get(format: string): ModelLoader | undefined
  supports(format: string): boolean
}
