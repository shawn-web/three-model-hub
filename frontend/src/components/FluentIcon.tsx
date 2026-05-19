/**
 * Fluent UI 风格图标组件
 * 基于 @iconify/react 按需加载 Fluent 图标集
 * 保持原有导出名称不变，其他文件无需修改
 */
import { Icon } from '@iconify/react'

interface FluentIconProps {
  size?: number | string
  color?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * 图标工厂函数
 * 根据图标集名称创建对应的 React 组件
 * 支持按需加载，不会导致 OOM
 */
function createIcon(iconName: string) {
  const Component = ({ size = 16, color, className, style }: FluentIconProps) => (
    <Icon
      icon={iconName}
      width={size}
      height={size}
      style={{ color, ...style }}
      className={className}
    />
  )
  Component.displayName = `FluentIcon(${iconName})`
  return Component
}

// 房屋
export const Home20 = createIcon('fluent:home-20-regular')

// 立方体
export const Cube20 = createIcon('fluent:cube-20-regular')

// 文档
export const Document20 = createIcon('fluent:document-20-regular')

// 太阳（主题切换：亮色模式）
export const WeatherSunny20 = createIcon('fluent:weather-sunny-20-regular')

// 月亮（主题切换：暗色模式）
export const WeatherMoon20 = createIcon('fluent:weather-moon-20-regular')

// 相机（截图）
export const Camera20 = createIcon('fluent:camera-20-regular')

// 方块轮廓（线框模式）
export const Square20 = createIcon('fluent:square-20-regular')

// 眼睛（可见）
export const Eye20 = createIcon('fluent:eye-20-regular')

// 眼睛关闭（隐藏）
export const EyeOff20 = createIcon('fluent:eye-off-20-regular')

// 十字准星（聚焦到物体）
export const Target20 = createIcon('fluent:target-20-regular')

// 项目列表
export const BulletList20 = createIcon('fluent:text-bullet-list-ltr-20-regular')

// 删除
export const Delete20 = createIcon('fluent:delete-20-regular')

// 消息气泡
export const Comment20 = createIcon('fluent:comment-20-regular')

// 加号（新增）
export const Add20 = createIcon('fluent:add-20-regular')

// 编辑/铅笔
export const Edit20 = createIcon('fluent:edit-20-regular')

// 复制
export const Copy20 = createIcon('fluent:copy-20-regular')

// 上传箭头
export const ArrowUpload20 = createIcon('fluent:arrow-upload-20-regular')

// 下载箭头
export const ArrowDownload20 = createIcon('fluent:arrow-download-20-regular')

// 左箭头
export const ArrowLeft20 = createIcon('fluent:arrow-left-20-regular')

// 撤销
export const ArrowUndo20 = createIcon('fluent:arrow-undo-20-regular')

// 重做
export const ArrowRedo20 = createIcon('fluent:arrow-redo-20-regular')

// 移动（四向箭头）
export const ArrowMove20 = createIcon('fluent:arrow-move-20-regular')

// 顺时针旋转
export const ArrowRotateClockwise20 = createIcon('fluent:arrow-rotate-clockwise-20-regular')

// 缩放（最大化）
export const ArrowMaximize20 = createIcon('fluent:arrow-maximize-20-regular')

// 同步/刷新
export const ArrowSync20 = createIcon('fluent:arrow-sync-20-regular')

// 打开文件夹
export const FolderOpen20 = createIcon('fluent:folder-open-20-regular')

// 保存
export const Save20 = createIcon('fluent:save-20-regular')

// 搜索
export const Search20 = createIcon('fluent:search-20-regular')

// 警告
export const Warning20 = createIcon('fluent:warning-20-regular')

// 建筑
export const Building20 = createIcon('fluent:building-20-regular')

// 地图标记
export const Location20 = createIcon('fluent:location-20-regular')

// 关闭/叉号
export const Dismiss20 = createIcon('fluent:dismiss-20-regular')

// 右箭头折叠
export const ChevronRight20 = createIcon('fluent:chevron-right-20-regular')

// 视频
export const Video20 = createIcon('fluent:video-20-regular')

// 加载旋转
export const SpinnerIos20 = createIcon('fluent:spinner-ios-20-regular')

// 图层/场景
export const LayerScene20 = createIcon('fluent:layer-20-regular')

// 3D 视口
export const Viewport3d20 = createIcon('fluent:cube-rotate-20-regular')
