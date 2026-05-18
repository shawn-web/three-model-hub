import { useEditStore } from '../store/edit-store'
import type { TransformMode } from '../store/edit-store'
import { extractEditData, downloadEditDataAsJson } from '../utils/edit-save'

interface EditToolbarProps {
  onLoadJson: () => void
}

const MODE_CONFIG = [
  { mode: 'translate' as TransformMode, label: '移动', key: 'G' },
  { mode: 'rotate' as TransformMode, label: '旋转', key: 'R' },
  { mode: 'scale' as TransformMode, label: '缩放', key: 'S' },
]

export function EditToolbar({ onLoadJson }: EditToolbarProps) {
  const transformMode = useEditStore((s) => s.transformMode)
  const setTransformMode = useEditStore((s) => s.setTransformMode)
  const modelUrl = useEditStore((s) => s.modelUrl)
  const editData = useEditStore((s) => s.editData)

  const handleSave = () => {
    if (!modelUrl) return
    const data = extractEditData(modelUrl, editData)
    downloadEditDataAsJson(data)
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? 'rgba(74, 158, 255, 0.9)' : 'rgba(255,255,255,0.08)',
    color: active ? '#fff' : '#aaa',
    transition: 'background 0.15s',
  })

  return (
    <div style={{
      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'rgba(20, 20, 30, 0.9)', borderRadius: 10, padding: '4px 8px',
      backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    }}>
      {MODE_CONFIG.map(({ mode, label, key }) => (
        <button key={mode} onClick={() => setTransformMode(mode)} style={btnStyle(transformMode === mode)}>
          {label} <span style={{ fontSize: 10, opacity: 0.5 }}>({key})</span>
        </button>
      ))}
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
      <button onClick={handleSave} style={btnStyle(false)}>保存</button>
      <button onClick={onLoadJson} style={btnStyle(false)}>加载</button>
    </div>
  )
}
