/**
 * Cesium 动态加载工具
 * 仅在访问 Geo 页面时加载 Cesium JS 和 CSS，避免影响其他页面性能
 *
 * 注意：normalTexCoords shader bug 通过 glb-normal-fix.ts 在 GLB 加载前
 * 移除法线贴图来绕过，不需要运行时 shader 补丁（Cesium 1.141.0 的 shader
 * 字符串在 IIFE 闭包变量中，无法从 window.Cesium 访问）
 */

/** Cesium 加载状态 */
let loadingPromise: Promise<void> | null = null

/**
 * 动态加载 Cesium 资源（JS + CSS）
 * 全局只加载一次，后续调用直接返回已完成的 Promise
 */
export function loadCesium(): Promise<void> {
   
  if ((window as any).Cesium) return Promise.resolve()
  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise<void>((resolve, reject) => {
    // 加载 CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/cesium/Widgets/widgets.css'
    document.head.appendChild(link)

    // 临时移除 AMD 全局变量，防止 Cesium.js 内部 define() 调用与 AMD 加载器冲突
     
    const savedDefine = (window as any).define
     
    const savedRequire = (window as any).require
     
    delete (window as any).define
     
    delete (window as any).require

    // 加载 JS
    const script = document.createElement('script')
    script.src = '/cesium/Cesium.js'
    script.onload = () => {
      // 恢复 AMD 全局变量
      if (savedDefine !== undefined) (window as any).define = savedDefine
      if (savedRequire !== undefined) (window as any).require = savedRequire

      // 验证 Cesium 是否成功初始化
      if (!(window as any).Cesium) {
        loadingPromise = null
        reject(new Error('Cesium 脚本已加载但 window.Cesium 不可用'))
        return
      }
      resolve()
    }
    script.onerror = () => {
      // 恢复 AMD 全局变量
      if (savedDefine !== undefined) (window as any).define = savedDefine
      if (savedRequire !== undefined) (window as any).require = savedRequire
      loadingPromise = null // 允许重试
      reject(new Error('Cesium 加载失败'))
    }
    document.head.appendChild(script)
  })

  return loadingPromise
}
