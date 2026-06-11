import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    // 开发时并行运行 TypeScript 类型检查，错误直接显示在浏览器 overlay
    checker({ typescript: true }),
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      // 将 /api 请求代理到后端
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      // Cesium 通过动态 script 标签加载，不打包
      external: ['cesium'],
    },
  },
  optimizeDeps: {
    // 预构建时排除 Cesium，避免 Rolldown 处理大文件崩溃
    exclude: ['cesium'],
  },
})
