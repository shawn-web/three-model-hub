interface ToolButtonProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}

export function ToolButton({ icon, label, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        background: active ? 'rgba(74, 158, 255, 0.9)' : 'rgba(255,255,255,0.06)',
        color: active ? '#fff' : '#aaa',
        transition: 'all 0.15s',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
      }}
    >
      {icon}
    </button>
  )
}
