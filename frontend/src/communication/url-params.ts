export interface UrlParams {
  modelUrl: string | null
  tools: string[]
  environment: string | null
  /** Viewer 专用：是否显示工具栏（由 toolbar 参数控制，默认 true） */
  toolbarVisible: boolean
  treeVisible: boolean
  editDataUrl: string | null
  // ---- Geo 页面专用 ----
  imagery?: string
  /** 底图图层类型（统一命名，读取 URL 的 type 参数，避免与 ViewerPage 的 type=model|scene 冲突） */
  imageryType: 'satellite' | 'vector' | 'terrain' | null
  /** @deprecated 兼容旧调用方，等同于 imageryType，后续迁移完成后移除 */
  geoType: 'satellite' | 'vector' | 'terrain' | null
  showToolbar?: boolean
  showPanel?: boolean
  /** 允许的 postMessage 来源域名白名单：null=走 referrer，[]=拒绝全部，非空=白名单 */
  allowedOrigins: string[] | null
  /**
   * 可见模型 ID 过滤（三态语义）：
   * - null：未传参数，不过滤，全部显示
   * - []：显式传空，全部隐藏
   * - 非空：白名单，仅显示列表内模型
   */
  visibleModelIds: string[] | null
  /** 隐藏的 Geo 工具按钮 ID 列表 */
  hiddenTools: string[] | null
  showMarkers?: boolean
  /** 相机视角参数，viewpoint 为兼容别名 */
  camera?: {
    longitude: number
    latitude: number
    altitude: number
    heading?: number
    pitch?: number
    range?: number
  } | null
}

/** 解析布尔参数，返回 true/false 或 undefined（未传） */
function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) return undefined
  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false
  return undefined
}

/** 解析逗号分隔列表，返回非空数组或 null（未传 / 解析为空） */
function parseListParam(value: string | null): string[] | null {
  const list = value?.split(',').map((item) => item.trim()).filter((item) => item.length > 0)
  return list && list.length > 0 ? list : null
}

/** 解析相机视角参数（camera 或 viewpoint 别名），解析失败返回 null，避免阻断加载 */
function parseCameraParam(value: string | null): UrlParams['camera'] {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as NonNullable<NonNullable<UrlParams['camera']>>
    if (
      parsed
      && typeof parsed.longitude === 'number'
      && typeof parsed.latitude === 'number'
      && typeof parsed.altitude === 'number'
    ) {
      return parsed
    }
  } catch {
    // URL 配置解析失败时容忍跳过，避免阻断地图加载
  }
  return null
}

export function parseUrlParams(search: string): UrlParams {
  const params = new URLSearchParams(search)
  const showMarkers = parseBooleanParam(params.get('showMarkers'))
  // 区分三种状态：未传（null），全部显示；传值 []（空数组），全部隐藏；非空白名单
  // 关键：params.has('visibleModelIds') 为 true 即视为显式配置（"过滤为空"），应当解析为 []。
  // 因此不能依赖 parseListParam（它对纯逗号字符串 ',,,' 也会返回 null），
  // 需在 has() 为真时强制赋 []，仅在 has() 为假（参数未传）才返回 null。
  const visibleModelIds: string[] | null = params.has('visibleModelIds')
    ? (parseListParam(params.get('visibleModelIds')) ?? [])
    : null

  // 底图类型：统一字段 imageryType，读取 URL 的 type 参数（兼容 Geo 旧逻辑），避免与 ViewerPage 的 type 冲突
  const imageryType: 'satellite' | 'vector' | 'terrain' | null =
    ['satellite', 'vector', 'terrain'].includes(params.get('type') || '')
      ? (params.get('type') as 'satellite' | 'vector' | 'terrain')
      : null

  return {
    modelUrl: params.get('modelUrl'),
    tools: params.get('tools')?.split(',').map((s) => s.trim()).filter((s) => s.length > 0) ?? [],
    environment: params.get('environment'),
    toolbarVisible: params.get('toolbar') !== 'false',
    treeVisible: params.get('tree') !== 'false',
    editDataUrl: params.get('editData'),
    imagery: params.get('imagery') || undefined,
    // 命名统一：imageryType 为主字段，geoType 为兼容别名，二者同值
    imageryType,
    geoType: imageryType,
    showToolbar: params.has('toolbar') ? params.get('toolbar') !== 'false' : undefined,
    showPanel: params.has('panel') ? params.get('panel') !== 'false' : undefined,
    allowedOrigins: parseListParam(params.get('allowedOrigins')),
    visibleModelIds,
    hiddenTools: parseListParam(params.get('hiddenTools')),
    showMarkers,
    // camera 为主参数名，viewpoint 作为兼容别名
    camera: parseCameraParam(params.get('camera') || params.get('viewpoint')),
  }
}
