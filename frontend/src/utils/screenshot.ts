/**
 * 截图工具函数
 * - 从 Three.js canvas 截取当前视口
 * - 使用 gl.domElement.toDataURL('image/png')
 * - 自动下载为 PNG 文件
 * - 可选保存为场景缩略图（返回 base64）
 *
 * 重要：WebGL Canvas 必须设置 preserveDrawingBuffer: true，
 * 否则在 toDataURL() 调用时缓冲区已被清除，截图将为空白。
 * 在 React Three Fiber 中通过 <Canvas gl={{ preserveDrawingBuffer: true }} /> 设置。
 */

/**
 * 从 canvas 元素截取当前视口图像
 * @param canvas - WebGL canvas 元素，如果未提供则自动查找
 * @returns base64 编码的 PNG 图像数据
 */
export function captureScreenshot(canvas?: HTMLCanvasElement): string {
  // 如果未提供 canvas，尝试从 DOM 中查找 Three.js 的 canvas
  const target = canvas || findThreeCanvas()
  if (!target) {
    throw new Error('未找到 WebGL Canvas 元素，无法截图')
  }

  // 检查 canvas 尺寸是否有效（宽或高为 0 说明 canvas 尚未就绪）
  if (target.width === 0 || target.height === 0) {
    throw new Error('Canvas 尺寸为 0，可能尚未完成初始化，请稍后再试')
  }

  // 检查 WebGL 上下文是否设置了 preserveDrawingBuffer
  const gl = target.getContext('webgl') || target.getContext('webgl2')
  if (gl) {
    const attrs = gl.getContextAttributes()
    if (attrs && !attrs.preserveDrawingBuffer) {
      console.warn(
        '[Screenshot] WebGL 上下文未设置 preserveDrawingBuffer: true，' +
        '截图可能为空白。请在 <Canvas gl={{ preserveDrawingBuffer: true }} /> 中启用此选项。'
      )
    }
  }

  try {
    return target.toDataURL('image/png')
  } catch (err) {
    throw new Error(`截图失败: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
  }
}

/**
 * 截取当前视口并自动下载为 PNG 文件
 * @param filename - 下载文件名（不含扩展名），默认使用时间戳
 */
export function downloadScreenshot(filename?: string): void {
  try {
    const dataUrl = captureScreenshot()
    const name = filename || `screenshot_${formatTimestamp()}`

    // 创建临时链接触发下载
    const link = document.createElement('a')
    link.download = `${name}.png`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('[Screenshot] 截图下载失败:', err)
  }
}

/**
 * 截取当前视口并返回 base64 数据（可用于场景缩略图）
 * @returns base64 编码的 PNG 图像数据，失败时返回 null
 */
export function captureAsThumbnail(): string | null {
  try {
    return captureScreenshot()
  } catch (err) {
    console.error('[Screenshot] 缩略图截取失败:', err)
    return null
  }
}

/**
 * 查找页面上的 Three.js WebGL canvas 元素
 * 优先查找 data-engine 属性为 three.js 的 canvas
 */
function findThreeCanvas(): HTMLCanvasElement | null {
  // React Three Fiber 渲染的 canvas 通常具有 data-engine 属性
  const canvas = document.querySelector('canvas[data-engine*="three"]') as HTMLCanvasElement | null
  if (canvas) return canvas

  // 回退：查找页面中的第一个 canvas 元素
  return document.querySelector('canvas') as HTMLCanvasElement | null
}

/**
 * 格式化当前时间为文件名安全的字符串
 */
function formatTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}
