interface ToolButtonProps {
  icon: string
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
        borderRadius: 4,
        cursor: 'pointer',
        background: active ? '#4a9eff' : 'rgba(255,255,255,0.08)',
        color: active ? '#fff' : '#ccc',
        fontSize: 18,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
      }}
    >
      {icon}
    </button>
  )
}
