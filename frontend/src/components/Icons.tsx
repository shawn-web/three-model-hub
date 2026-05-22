/* eslint-disable react-refresh/only-export-components */
/**
 * Lucide 图标组件
 * 基于 @iconify-icons/lucide 离线图标数据，构建时打包，无运行时网络请求
 */
import { Icon } from '@iconify/react'
import homeIcon from '@iconify-icons/lucide/home'
import mousePointerIcon from '@iconify-icons/lucide/mouse-pointer'
import scissorsIcon from '@iconify-icons/lucide/scissors'
import rulerIcon from '@iconify-icons/lucide/ruler'
import maximizeIcon from '@iconify-icons/lucide/maximize'
import rotateCwIcon from '@iconify-icons/lucide/rotate-cw'
import moveIcon from '@iconify-icons/lucide/move'
import scalingIcon from '@iconify-icons/lucide/scaling'
import saveIcon from '@iconify-icons/lucide/save'
import fileCode2Icon from '@iconify-icons/lucide/file-code-2'
import cameraIcon from '@iconify-icons/lucide/camera'
import imageIcon from '@iconify-icons/lucide/image'
import uploadIcon from '@iconify-icons/lucide/upload'
import undo2Icon from '@iconify-icons/lucide/undo-2'
import settingsIcon from '@iconify-icons/lucide/settings'
import trash2Icon from '@iconify-icons/lucide/trash-2'
import mapPinIcon from '@iconify-icons/lucide/map-pin'
import panelLeftIcon from '@iconify-icons/lucide/panel-left'
import panelLeftCloseIcon from '@iconify-icons/lucide/panel-left-close'
import crosshairIcon from '@iconify-icons/lucide/crosshair'
import imagePlusIcon from '@iconify-icons/lucide/image-plus'
import videoIcon from '@iconify-icons/lucide/video'
import typeIcon from '@iconify-icons/lucide/type'
import globeIcon from '@iconify-icons/lucide/globe'
import plusIcon from '@iconify-icons/lucide/plus'
import xIcon from '@iconify-icons/lucide/x'
import folderIcon from '@iconify-icons/lucide/folder'
import layersIcon from '@iconify-icons/lucide/layers'
import gitBranchIcon from '@iconify-icons/lucide/git-branch'
import slidersIcon from '@iconify-icons/lucide/sliders'
import eyeIcon from '@iconify-icons/lucide/eye'

interface IconProps {
  size?: number | string
  color?: string
}

// 工具栏组件
export function IconHome({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={homeIcon} width={size} height={size} style={{ color }} />
}
export function IconPointer({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={mousePointerIcon} width={size} height={size} style={{ color }} />
}
export function IconCut({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={scissorsIcon} width={size} height={size} style={{ color }} />
}
export function IconRuler({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={rulerIcon} width={size} height={size} style={{ color }} />
}
export function IconFitView({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={maximizeIcon} width={size} height={size} style={{ color }} />
}
export function IconRotate({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={rotateCwIcon} width={size} height={size} style={{ color }} />
}
export function IconMove({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={moveIcon} width={size} height={size} style={{ color }} />
}
export function IconScale({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={scalingIcon} width={size} height={size} style={{ color }} />
}
export function IconSave({ size = 18, color = 'currentColor' }: IconProps) {
  return <Icon icon={saveIcon} width={size} height={size} style={{ color }} />
}

// 离线图标数据导出，供其他组件直接传给 <Icon icon={...} />
export {
  fileCode2Icon, cameraIcon, imageIcon, uploadIcon, undo2Icon,
  settingsIcon, trash2Icon, mapPinIcon, panelLeftIcon, panelLeftCloseIcon,
  crosshairIcon, imagePlusIcon, videoIcon, typeIcon, globeIcon,
  plusIcon, xIcon, folderIcon, layersIcon, gitBranchIcon, slidersIcon,
  homeIcon, maximizeIcon, moveIcon, rotateCwIcon, scalingIcon,
  eyeIcon,
}
