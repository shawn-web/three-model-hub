import { memo } from 'react'

/**
 * 站点 Logo（与 public/favicon.svg 同源）
 * 等距 3D 立方体堆叠 + 渐变发光，呼应 3D 模型管理 + 场景组合核心业务
 */
export const Logo = memo(function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="three-model-hub logo"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B1220" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="logoTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="logoLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="logoRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#0891B2" />
        </linearGradient>
        <linearGradient id="logoTop2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="logoLeft2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="logoRight2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#0E7490" />
        </linearGradient>
        <radialGradient id="logoHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="70%" stopColor="#6366F1" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
        </radialGradient>
        <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logoBg)" />
      <circle cx="16" cy="16" r="14" fill="url(#logoHalo)" />
      <g filter="url(#logoGlow)">
        {/* 后方立方体（堆叠，表达场景组合） */}
        <g transform="translate(-4.5 -3)">
          <polygon points="16,4 24,8.5 16,13 8,8.5" fill="url(#logoTop2)" />
          <polygon points="8,8.5 16,13 16,22 8,17.5" fill="url(#logoLeft2)" />
          <polygon points="24,8.5 16,13 16,22 24,17.5" fill="url(#logoRight2)" />
        </g>
        {/* 前方主立方体 */}
        <g transform="translate(4.5 3)">
          <polygon points="16,4 24,8.5 16,13 8,8.5" fill="url(#logoTop)" />
          <polygon points="8,8.5 16,13 16,22 8,17.5" fill="url(#logoLeft)" />
          <polygon points="24,8.5 16,13 16,22 24,17.5" fill="url(#logoRight)" />
        </g>
      </g>
    </svg>
  )
})