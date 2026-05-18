import { useEditStore } from '../store/edit-store'
import { ComponentTree } from './ComponentTree'
import { PropertyEditor } from './PropertyEditor'

export function EditPanel() {
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)

  return (
    <div style={{
      width: 280,
      height: '100%',
      background: 'rgba(20, 20, 30, 0.95)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#fff',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600, fontSize: 14 }}>
        构件列表
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <ComponentTree />
      </div>
      {selectedComponentId && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', overflow: 'auto', maxHeight: '50%' }}>
          <PropertyEditor />
        </div>
      )}
    </div>
  )
}
