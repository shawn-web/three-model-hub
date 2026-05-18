import { useEditStore } from '../store/edit-store'
import * as THREE from 'three'

export function ComponentTree() {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)

  if (!modelObject) return <div style={{ padding: 16, color: '#666' }}>未加载模型</div>

  const children = modelObject.children

  return (
    <div>
      {children.map((child) => (
        <ComponentItem key={child.uuid} object={child} selected={selectedComponentId === child.uuid} />
      ))}
    </div>
  )
}

function ComponentItem({ object, selected }: { object: THREE.Object3D; selected: boolean }) {
  const selectComponent = useEditStore((s) => s.selectComponent)
  const updateComponentVisibility = useEditStore((s) => s.updateComponentVisibility)
  const editData = useEditStore((s) => s.editData)
  const data = editData[object.uuid]
  const visible = data?.visible ?? object.visible

  return (
    <div
      onClick={() => selectComponent(object.uuid)}
      style={{
        padding: '8px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: selected ? 'rgba(74, 158, 255, 0.15)' : 'transparent',
        borderLeft: selected ? '3px solid #4a9eff' : '3px solid transparent',
        fontSize: 13,
        color: visible ? '#ddd' : '#666',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {object.name || object.type}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          const newVisible = !visible
          object.visible = newVisible
          updateComponentVisibility(object.uuid, newVisible)
        }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
          color: visible ? '#4a9eff' : '#555', fontSize: 14,
        }}
        title={visible ? '隐藏' : '显示'}
      >
        {visible ? '\u{1F441}' : '\u{1F6AB}'}
      </button>
    </div>
  )
}
