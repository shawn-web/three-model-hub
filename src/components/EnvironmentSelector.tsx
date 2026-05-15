import { useViewerStore } from '../store/viewer-store'

const ENVIRONMENT_PRESETS = [
  { id: 'day', label: '晴天', preset: 'city' },
  { id: 'sunset', label: '黄昏', preset: 'sunset' },
  { id: 'dawn', label: '黎明', preset: 'dawn' },
  { id: 'night', label: '夜晚', preset: 'night' },
  { id: 'warehouse', label: '室内', preset: 'warehouse' },
  { id: 'none', label: '纯色', preset: 'none' },
] as const

export function EnvironmentSelector() {
  const environmentPreset = useViewerStore((s) => s.environmentPreset)
  const setEnvironmentPreset = useViewerStore((s) => s.setEnvironmentPreset)

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      display: 'flex',
      gap: 4,
      background: 'rgba(0,0,0,0.6)',
      borderRadius: 6,
      padding: 4,
    }}>
      {ENVIRONMENT_PRESETS.map((env) => (
        <button
          key={env.id}
          onClick={() => setEnvironmentPreset(env.id)}
          style={{
            padding: '4px 8px',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
            background: environmentPreset === env.id ? '#4a9eff' : 'rgba(255,255,255,0.1)',
            color: '#fff',
          }}
        >
          {env.label}
        </button>
      ))}
    </div>
  )
}
