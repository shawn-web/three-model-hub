/**
 * 生成默认标点图标（红色定位 pin）的 Data URL
 * 供场景编辑器、Geo 标点等模块复用，避免多处重复 Canvas 绘制逻辑
 */

let _defaultMarkerDataUrl: string | null = null

export function createDefaultMarkerImage(): string {
  if (_defaultMarkerDataUrl) return _defaultMarkerDataUrl
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.beginPath()
  ctx.arc(32, 22, 16, Math.PI, 0, false)
  ctx.quadraticCurveTo(48, 38, 32, 56)
  ctx.quadraticCurveTo(16, 38, 16, 22)
  ctx.closePath()
  ctx.fillStyle = '#ff4444'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(32, 22, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  _defaultMarkerDataUrl = canvas.toDataURL('image/png')
  return _defaultMarkerDataUrl
}
