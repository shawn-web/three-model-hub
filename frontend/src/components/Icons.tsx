/**
 * 工具栏专用图标
 * 保留原有的自定义 SVG 用于 3D 编辑器工具栏
 * 这些图标是 Lucide 风格的 stroke 图标，用于查看器工具栏
 */
import { Icon } from '@iconify/react'

interface IconProps {
  size?: number | string
  color?: string
}

export function IconHome({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:home" width={size} height={size} style={{ color }} />
}

export function IconPointer({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:mouse-pointer" width={size} height={size} style={{ color }} />
}

export function IconCut({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:scissors" width={size} height={size} style={{ color }} />
}

export function IconRuler({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:ruler" width={size} height={size} style={{ color }} />
}

export function IconFitView({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:maximize" width={size} height={size} style={{ color }} />
}

export function IconRotate({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:rotate-cw" width={size} height={size} style={{ color }} />
}

export function IconMove({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:move" width={size} height={size} style={{ color }} />
}

export function IconScale({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:scaling" width={size} height={size} style={{ color }} />
}

export function IconSave({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon="lucide:save" width={size} height={size} style={{ color }} />
}
