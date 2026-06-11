/** 获取全局 Cesium 实例（延迟求值，避免模块加载时未就绪） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCs(): any {
  return (window as any).Cesium
}
