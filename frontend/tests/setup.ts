// 集中配置测试环境：jest-dom matchers + 全局 stub
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Cesium 影像服务需要天地图 token，测试中给一个固定值避免漏取环境变量报错
vi.stubEnv('VITE_TIANDITU_TOKEN', 'test-token')

// jsdom 不实现 matchMedia，antd 等组件可能依赖
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}
