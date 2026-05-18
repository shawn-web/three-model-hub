import { useEffect, useRef } from 'react'
import { EditCanvas } from './components/EditCanvas'
import { EditPanel } from './components/EditPanel'
import { EditToolbar } from './components/EditToolbar'
import { useEditStore } from './store/edit-store'
import { GlbLoader } from './loaders/glb-loader'
import { parseUrlParams } from './communication/url-params'
import { applyEditData } from './utils/edit-apply'
import { readJsonFile } from './utils/edit-save'
import type { EditData } from './types/edit-data'

export function EditApp() {
  const modelLoading = useEditStore((s) => s.modelLoading)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const params = parseUrlParams(window.location.search)
    const store = useEditStore.getState()

    if (params.modelUrl) {
      store.setModelUrl(params.modelUrl)
      store.setModelLoading(true)

      const loader = new GlbLoader()
      loader.load(params.modelUrl).then((model) => {
        store.setModelObject(model)
        store.setModelLoading(false)

        // If editData URL is provided, fetch and apply
        if (params.editDataUrl) {
          fetch(params.editDataUrl)
            .then((r) => r.json())
            .then((editData: EditData) => {
              applyEditData(model, editData)
            })
            .catch((err) => console.error('Failed to load edit data:', err))
        }
      }).catch((err) => {
        console.error('Failed to load model:', err)
        store.setModelLoading(false)
      })
    }
  }, [])

  const handleLoadJson = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const editData = await readJsonFile(file)
      const model = useEditStore.getState().modelObject
      if (model) {
        applyEditData(model, editData)
      }
    } catch (err) {
      console.error('Failed to load JSON:', err)
    }
    e.target.value = ''
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', position: 'relative', overflow: 'hidden', background: '#1a1a2e' }}>
      <EditPanel />
      <div style={{ flex: 1, position: 'relative' }}>
        <EditCanvas />
        <EditToolbar onLoadJson={handleLoadJson} />
        {modelLoading && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            color: '#fff', fontSize: 16, background: 'rgba(0,0,0,0.6)', padding: '12px 24px', borderRadius: 8,
          }}>
            加载中...
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  )
}
