import type { EditData, ComponentEdit } from '../types/edit-data'
import type { EditComponentData } from '../store/edit-store'

export function extractEditData(
  modelUrl: string,
  editData: Record<string, EditComponentData>,
  backgroundColor: string,
  autoRotate: boolean,
  markers: EditData['markers'],
): EditData {
  const components: Record<string, ComponentEdit> = {}

  for (const [uuid, edit] of Object.entries(editData)) {
    components[uuid] = {
      transform: {
        position: edit.position,
        rotation: edit.rotation,
        scale: edit.scale,
      },
      material: {
        color: edit.color,
        opacity: edit.opacity,
        mapUrl: edit.mapUrl,
        normalMapUrl: edit.normalMapUrl,
        roughnessMapUrl: edit.roughnessMapUrl,
        metalnessMapUrl: edit.metalnessMapUrl,
        emissiveMapUrl: edit.emissiveMapUrl,
      },
      visible: edit.visible,
      name: edit.name,
      description: edit.description,
    }
  }

  return {
    version: 2,
    modelUrl,
    backgroundColor,
    autoRotate,
    components,
    markers,
  }
}

export function downloadEditDataAsJson(editData: EditData): void {
  const json = JSON.stringify(editData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const modelName = editData.modelUrl.split('/').pop()?.replace('.glb', '') || 'model'
  a.download = `${modelName}-edits.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function readJsonFile(file: File): Promise<EditData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string))
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
