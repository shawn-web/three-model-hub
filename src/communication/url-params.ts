export interface UrlParams {
  modelUrl: string | null
  tools: string[]
  environment: string | null
  toolbarVisible: boolean
  editDataUrl: string | null
}

export function parseUrlParams(search: string): UrlParams {
  const params = new URLSearchParams(search)

  return {
    modelUrl: params.get('modelUrl'),
    tools: params.get('tools')?.split(',').filter(Boolean) ?? [],
    environment: params.get('environment'),
    toolbarVisible: params.get('toolbar') !== 'false',
    editDataUrl: params.get('editData'),
  }
}
