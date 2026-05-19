import { describe, it, expect, beforeEach } from 'vitest'
import { LoaderRegistryImpl } from '../src/loaders/loader-registry'
import type { ModelLoader } from '../src/loaders/types'
import * as THREE from 'three'

function createMockLoader(format: string): ModelLoader {
  return {
    format,
    load: async () => new THREE.Group(),
    dispose: () => {},
  }
}

describe('LoaderRegistry', () => {
  let registry: LoaderRegistryImpl

  beforeEach(() => {
    registry = new LoaderRegistryImpl()
  })

  it('should register a loader', () => {
    const loader = createMockLoader('glb')
    registry.register(loader)
    expect(registry.supports('glb')).toBe(true)
  })

  it('should get a loader by format', () => {
    const loader = createMockLoader('glb')
    registry.register(loader)
    expect(registry.get('glb')).toBe(loader)
  })

  it('should return undefined for unsupported format', () => {
    expect(registry.get('fbx')).toBeUndefined()
  })

  it('should report unsupported format', () => {
    expect(registry.supports('fbx')).toBe(false)
  })

  it('should detect format from URL extension', () => {
    expect(registry.detectFormat('http://example.com/model.glb')).toBe('glb')
    expect(registry.detectFormat('model.FBX')).toBe('fbx')
    expect(registry.detectFormat('no-extension')).toBeNull()
  })
})
