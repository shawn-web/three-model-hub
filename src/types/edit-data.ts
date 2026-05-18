export interface ComponentEdit {
  transform: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
  material: {
    color: string | null
    opacity: number | null
  }
  visible: boolean
}

export interface EditData {
  version: 1
  modelUrl: string
  components: Record<string, ComponentEdit>
}
