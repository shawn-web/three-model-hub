import { useCallback } from 'react'
import { Icon } from '@iconify/react'
import { ToolButton } from './ToolButton'
import { useEditStore } from '../store/edit-store'
import type { TransformMode } from '../store/edit-store'

interface EditToolbarProps {
  onFitView: () => void
}

const TRANSFORM_MODES: { mode: TransformMode; icon: string; label: string; shortcut: string }[] = [
  { mode: 'translate', icon: 'lucide:move', label: '移动', shortcut: 'W' },
  { mode: 'rotate', icon: 'lucide:rotate-cw', label: '旋转', shortcut: 'E' },
  { mode: 'scale', icon: 'lucide:scaling', label: '缩放', shortcut: 'R' },
]

export function EditToolbar({ onFitView }: EditToolbarProps) {
  const transformMode = useEditStore((s) => s.transformMode)
  const setTransformMode = useEditStore((s) => s.setTransformMode)

  const handleModeChange = useCallback((mode: TransformMode) => {
    setTransformMode(mode)
  }, [setTransformMode])

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
    </div>
  )
}
