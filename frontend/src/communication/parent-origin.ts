/**
 * 解析 document.referrer，返回父页面 origin
 *
 * 注意：referrer 在以下情况会为空 / 不可用：
 *   - HTTPS → HTTP 跳转
 *   - Referrer-Policy: no-referrer
 *   - 浏览器隐私模式
 *   - 用户从地址栏直接打开页面（非嵌入）
 *
 * 因此 MessageBus 必须把 null 视为「无可信 origin」，而不是 fallback 到 '*'。
 */
export function resolveReferrerOrigin(): string | null {
  if (typeof document === 'undefined' || !document.referrer) return null
  try {
    return new URL(document.referrer).origin
  } catch {
    return null
  }
}

/**
 * 兼容旧调用：返回 referrer origin 或 '*'
 *
 * @deprecated 直接调用 postMessage 时使用 '*' 会把消息广播给任何监听者。
 *             新代码应通过 MessageBus 走 allowlist 校验。
 *             保留是为了避免一次性改全部直接调用 window.parent.postMessage 的地方。
 */
export function getParentOrigin(): string {
  return resolveReferrerOrigin() ?? '*'
}
