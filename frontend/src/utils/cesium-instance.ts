/** 获取全局 Cesium 实例（延迟求值，避免模块加载时未就绪） */
 
export function getCs(): any {
  return (window as any).Cesium
}
