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
  name: string | null
  description: string | null
}

export interface MarkerPopup {
  title: string
  content: string
  imageUrl?: string
  linkUrl?: string
}

export interface MarkerData {
  id: string
  position: [number, number, number]
  imageUrl: string
  width: number
  height: number
  name: string
  popup?: MarkerPopup
}

export interface SceneImage {
  id: string
  url: string
  name: string
  width: number
  height: number
  position?: [number, number, number]
  scale?: [number, number, number]
  rotation?: [number, number, number]
  visible: boolean
}

export interface EditData {
  version: 2
  modelUrl: string
  backgroundColor: string
  autoRotate: boolean
  components: Record<string, ComponentEdit>
  markers: MarkerData[]
}
