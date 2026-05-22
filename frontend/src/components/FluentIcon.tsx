/**
 * Fluent UI 风格图标组件
 * 基于 @iconify-icons/fluent 离线图标数据，构建时打包，无运行时网络请求
 * 保持原有导出名称不变，其他文件无需修改
 */
import { Icon } from '@iconify/react'
import type { IconifyIcon } from '@iconify/types'
import home20Regular from '@iconify-icons/fluent/home-20-regular'
import cube20Regular from '@iconify-icons/fluent/cube-20-regular'
import document20Regular from '@iconify-icons/fluent/document-20-regular'
import weatherSunny20Regular from '@iconify-icons/fluent/weather-sunny-20-regular'
import weatherMoon20Regular from '@iconify-icons/fluent/weather-moon-20-regular'
import camera20Regular from '@iconify-icons/fluent/camera-20-regular'
import square20Regular from '@iconify-icons/fluent/square-20-regular'
import eye20Regular from '@iconify-icons/fluent/eye-20-regular'
import eyeOff20Regular from '@iconify-icons/fluent/eye-off-20-regular'
import target20Regular from '@iconify-icons/fluent/target-20-regular'
import textBulletListLtr20Regular from '@iconify-icons/fluent/text-bullet-list-ltr-20-regular'
import delete20Regular from '@iconify-icons/fluent/delete-20-regular'
import comment20Regular from '@iconify-icons/fluent/comment-20-regular'
import add20Regular from '@iconify-icons/fluent/add-20-regular'
import edit20Regular from '@iconify-icons/fluent/edit-20-regular'
import copy20Regular from '@iconify-icons/fluent/copy-20-regular'
import arrowUpload20Regular from '@iconify-icons/fluent/arrow-upload-20-regular'
import arrowDownload20Regular from '@iconify-icons/fluent/arrow-download-20-regular'
import arrowLeft20Regular from '@iconify-icons/fluent/arrow-left-20-regular'
import arrowUndo20Regular from '@iconify-icons/fluent/arrow-undo-20-regular'
import arrowRedo20Regular from '@iconify-icons/fluent/arrow-redo-20-regular'
import arrowMove20Regular from '@iconify-icons/fluent/arrow-move-20-regular'
import arrowRotateClockwise20Regular from '@iconify-icons/fluent/arrow-rotate-clockwise-20-regular'
import arrowMaximize20Regular from '@iconify-icons/fluent/arrow-maximize-20-regular'
import arrowSync20Regular from '@iconify-icons/fluent/arrow-sync-20-regular'
import folderOpen20Regular from '@iconify-icons/fluent/folder-open-20-regular'
import save20Regular from '@iconify-icons/fluent/save-20-regular'
import search20Regular from '@iconify-icons/fluent/search-20-regular'
import warning20Regular from '@iconify-icons/fluent/warning-20-regular'
import building20Regular from '@iconify-icons/fluent/building-20-regular'
import location20Regular from '@iconify-icons/fluent/location-20-regular'
import dismiss20Regular from '@iconify-icons/fluent/dismiss-20-regular'
import chevronRight20Regular from '@iconify-icons/fluent/chevron-right-20-regular'
import video20Regular from '@iconify-icons/fluent/video-20-regular'
import spinnerIos20Regular from '@iconify-icons/fluent/spinner-ios-20-regular'
import layer20Regular from '@iconify-icons/fluent/layer-20-regular'
import cubeRotate20Regular from '@iconify-icons/fluent/cube-rotate-20-regular'
import image20Regular from '@iconify-icons/fluent/image-20-regular'

interface FluentIconProps {
  size?: number | string
  color?: string
  className?: string
  style?: React.CSSProperties
}

/** 图标工厂函数，基于离线图标数据创建组件 */
function createIcon(iconData: IconifyIcon) {
  const Component = ({ size = 16, color, className, style }: FluentIconProps) => (
    <Icon
      icon={iconData}
      width={size}
      height={size}
      style={{ color, ...style }}
      className={className}
    />
  )
  Component.displayName = `FluentIcon(${(iconData as unknown as Record<string, string>).name ?? 'unknown'})`
  return Component
}

export const Home20 = createIcon(home20Regular)
export const Cube20 = createIcon(cube20Regular)
export const Document20 = createIcon(document20Regular)
export const WeatherSunny20 = createIcon(weatherSunny20Regular)
export const WeatherMoon20 = createIcon(weatherMoon20Regular)
export const Camera20 = createIcon(camera20Regular)
export const Square20 = createIcon(square20Regular)
export const Eye20 = createIcon(eye20Regular)
export const EyeOff20 = createIcon(eyeOff20Regular)
export const Target20 = createIcon(target20Regular)
export const BulletList20 = createIcon(textBulletListLtr20Regular)
export const Delete20 = createIcon(delete20Regular)
export const Comment20 = createIcon(comment20Regular)
export const Add20 = createIcon(add20Regular)
export const Edit20 = createIcon(edit20Regular)
export const Copy20 = createIcon(copy20Regular)
export const ArrowUpload20 = createIcon(arrowUpload20Regular)
export const ArrowDownload20 = createIcon(arrowDownload20Regular)
export const ArrowLeft20 = createIcon(arrowLeft20Regular)
export const ArrowUndo20 = createIcon(arrowUndo20Regular)
export const ArrowRedo20 = createIcon(arrowRedo20Regular)
export const ArrowMove20 = createIcon(arrowMove20Regular)
export const ArrowRotateClockwise20 = createIcon(arrowRotateClockwise20Regular)
export const ArrowMaximize20 = createIcon(arrowMaximize20Regular)
export const ArrowSync20 = createIcon(arrowSync20Regular)
export const FolderOpen20 = createIcon(folderOpen20Regular)
export const Save20 = createIcon(save20Regular)
export const Search20 = createIcon(search20Regular)
export const Warning20 = createIcon(warning20Regular)
export const Building20 = createIcon(building20Regular)
export const Location20 = createIcon(location20Regular)
export const Dismiss20 = createIcon(dismiss20Regular)
export const ChevronRight20 = createIcon(chevronRight20Regular)
export const Video20 = createIcon(video20Regular)
export const SpinnerIos20 = createIcon(spinnerIos20Regular)
export const LayerScene20 = createIcon(layer20Regular)
export const Viewport3d20 = createIcon(cubeRotate20Regular)
export const Image20 = createIcon(image20Regular)
