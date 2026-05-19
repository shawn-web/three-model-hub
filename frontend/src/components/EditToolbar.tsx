import { useCallback } from 'react'
import { Icon } from '@iconify/react'
import { ToolButton } from './ToolButton'
import { useEditStore } from '../store/edit-store'
import type { TransformMode } from '../store/edit-store'
import { captureAsThumbnail } from '../utils/screenshot'
import { downloadScreenshot } from '../utils/screenshot'

interface EditToolbarProps {
  onFitView: () => void
  onSave: () => void
  onSetThumbnail: (dataUrl: string) => void
  saving: boolean
}

const TRANSFORM_MODES: { mode: TransformMode; icon: string; label: string; shortcut: string }[] = [
  { mode: 'translate', icon: 'lucide:move', label: '移动', shortcut: 'W' },
  { mode: 'rotate', icon: 'lucide:rotate-cw', label: '旋转', shortcut: 'E' },
  { mode: 'scale', icon: 'lucide:scaling', label: '缩放', shortcut: 'R' },
]

export function EditToolbar({ onFitView, onSave, onSetThumbnail, saving }: EditToolbarProps) {
  const transformMode = useEditStore((s) => s.transformMode)
  const setTransformMode = useEditStore((s) => s.setTransformMode)
  const isDirty = useEditStore((s) => s.isDirty)

  const handleModeChange = useCallback((mode: TransformMode) => {
    setTransformMode(mode)
  }, [setTransformMode])

  const handleScreenshot = useCallback(() => {
    downloadScreenshot()
  }, [])

  const handleThumbnail = useCallback(() => {
    const dataUrl = captureAsThumbnail()
    if (dataUrl) onSetThumbnail(dataUrl)
  }, [onSetThumbnail])

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[rgba(20,20,30,0.9)] rounded-[10px] backdrop-blur-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.4)] py-1 px-2">
      {TRANSFORM_MODES.map(({ mode, icon, label, shortcut }) => (
        <ToolButton
          key={mode}
          icon={<Icon icon={icon} width={16} height={16} />}
          label={`${label} (${shortcut})`}
          active={transformMode === mode}
          onClick={() => handleModeChange(mode)}
        />
      ))}

      <div className="w-px h-5 bg-white/[0.12] mx-0.5" />

      <ToolButton
        icon={<Icon icon="lucide:maximize" width={16} height={16} />}
        label="适配视图"
        onClick={onFitView}
      />

      <div className="w-px h-5 bg-white/[0.12] mx-0.5" />

      <ToolButton
        icon={<Icon icon="lucide:camera" width={16} height={16} />}
        label="截图下载"
        onClick={handleScreenshot}
      />

      <ToolButton
        icon={<Icon icon="lucide:image" width={16} height={16} />}
        label="设为封面"
        onClick={handleThumbnail}
      />

      <div className="w-px h-5 bg-white/[0.12] mx-0.5" />

      <ToolButton
        icon={<Icon icon="lucide:save" width={16} height={16} />}
        label={`保存${isDirty ? ' *' : ''}`}
        onClick={onSave}
        active={isDirty}
      />
      {saving && (
        <span className="text-white/50 text-[10px] ml-1">保存中...</span>
      )}
    </div>
  )
}
