import { describe, it, expect } from 'vitest'
import { parseUrlParams } from '../src/communication/url-params'

describe('parseUrlParams', () => {
  it('should parse modelUrl from query string', () => {
    const result = parseUrlParams('?modelUrl=http://example.com/model.glb')
    expect(result.modelUrl).toBe('http://example.com/model.glb')
  })

  it('should parse tools list', () => {
    const result = parseUrlParams('?tools=navigation,picking,measurement')
    expect(result.tools).toEqual(['navigation', 'picking', 'measurement'])
  })

  it('should parse environment preset', () => {
    const result = parseUrlParams('?environment=sunset')
    expect(result.environment).toBe('sunset')
  })

  it('should return defaults when no params', () => {
    const result = parseUrlParams('')
    expect(result.modelUrl).toBeNull()
    expect(result.tools).toEqual([])
    expect(result.environment).toBeNull()
  })

  it('should handle URL-encoded values', () => {
    const result = parseUrlParams('?modelUrl=http%3A%2F%2Fexample.com%2Fmodel.glb')
    expect(result.modelUrl).toBe('http://example.com/model.glb')
  })

  it('should parse toolbar visibility', () => {
    const result = parseUrlParams('?toolbar=false')
    expect(result.toolbarVisible).toBe(false)
  })
})
