import { describe, it, expect, afterEach } from 'vitest'
import { getParentOrigin } from '../src/communication/parent-origin'

/**
 * getParentOrigin 读取 document.referrer，
 * jsdom 中默认 referrer 为空，因此测试需要逐个用例设置/清理。
 */
describe('getParentOrigin', () => {
  const originalReferrer = document.referrer

  afterEach(() => {
    // 清理 referrer（用 defineProperty 是 jsdom 下唯一可控方式）
    Object.defineProperty(document, 'referrer', {
      value: originalReferrer,
      configurable: true,
      writable: true,
    })
  })

  it('无 referrer 时应返回通配符 "*"', () => {
    Object.defineProperty(document, 'referrer', {
      value: '',
      configurable: true,
      writable: true,
    })
    expect(getParentOrigin()).toBe('*')
  })

  it('有效 referrer 应返回 URL.origin（去除路径）', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://parent.example.com/some/path?q=1',
      configurable: true,
      writable: true,
    })
    expect(getParentOrigin()).toBe('https://parent.example.com')
  })

  it('非法 URL 应安全降级为 "*" 而不抛错', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'not-a-valid-url',
      configurable: true,
      writable: true,
    })
    expect(getParentOrigin()).toBe('*')
  })

  it('带端口的 referrer 应保留端口', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'http://localhost:5173/iframe',
      configurable: true,
      writable: true,
    })
    expect(getParentOrigin()).toBe('http://localhost:5173')
  })

  it('含子域的 HTTPS referrer 应保留子域', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://app.sub.example.com/page',
      configurable: true,
      writable: true,
    })
    expect(getParentOrigin()).toBe('https://app.sub.example.com')
  })
})
