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
      className={`w-9 h-9 flex items-center justify-center border-none rounded-md cursor-pointer outline-none transition-all duration-150 ${
        active
          ? 'bg-[rgba(74,158,255,0.9)] text-white'
          : 'bg-white/[0.06] text-[#aaa] hover:bg-white/[0.12]'
      }`}
    >
      {icon}
    </button>
  )
}
