import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      // 将 /api 请求代理到后端
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 将文件上传请求代理到文件服务，获取真实上传进度
      '/hz-file-upload': {
        target: 'http://tapi.huazhukeji.cn:82',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
})
