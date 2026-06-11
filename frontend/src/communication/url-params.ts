export interface UrlParams {
  modelUrl: string | null
  tools: string[]
  environment: string | null
  toolbarVisible: boolean
  treeVisible: boolean
  editDataUrl: string | null
  // Geo 页面专用
  imagery?: string
  geoType?: 'satellite' | 'vector' | 'terrain'
  showToolbar?: boolean
  showPanel?: boolean
  allowedOrigins?: string[]
  visibleModelIds?: string[] | null
  hiddenTools?: string[]
  showMarkers?: boolean
  camera?: {
    longitude: number
    latitude: number
    altitude: number
    heading?: number
    pitch?: number
  }
}

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) return undefined
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false
  return undefined
}

function parseListParam(value: string | null): string[] | undefined {
  const list = value?.split(',').map((item) => item.trim()).filter(Boolean)
  return list && list.length > 0 ? list : undefined
}

function parseCameraParam(value: string | null): UrlParams['camera'] {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as UrlParams['camera']
    if (
      parsed
      && typeof parsed.longitude === 'number'
      && typeof parsed.latitude === 'number'
      && typeof parsed.altitude === 'number'
    ) {
      return parsed
    }
  } catch {
    // URL 配置解析失败时忽略，避免阻断地图加载
  }
  return undefined
}

export function parseUrlParams(search: string): UrlParams {
  const params = new URLSearchParams(search)
  const showMarkers = parseBooleanParam(params.get('showMarkers'))
  const visibleModelIds = params.has('visibleModelIds')
    ? parseListParam(params.get('visibleModelIds')) ?? null
    : undefined

  return {
    modelUrl: params.get('modelUrl'),
    tools: params.get('tools')?.split(',').filter(Boolean) ?? [],
    environment: params.get('environment'),
    toolbarVisible: params.get('toolbar') !== 'false',
    treeVisible: params.get('tree') !== 'false',
    editDataUrl: params.get('editData'),
    imagery: params.get('imagery') || undefined,
    geoType: ['satellite', 'vector', 'terrain'].includes(params.get('type') || '')
      ? (params.get('type') as 'satellite' | 'vector' | 'terrain')
      : undefined,
    showToolbar: params.has('toolbar') ? params.get('toolbar') !== 'false' : undefined,
    showPanel: params.has('panel') ? params.get('panel') !== 'false' : undefined,
    allowedOrigins: parseListParam(params.get('allowedOrigins')),
    visibleModelIds,
    hiddenTools: parseListParam(params.get('hiddenTools')),
    showMarkers,
    camera: parseCameraParam(params.get('camera') || params.get('viewpoint')),
  }
}
