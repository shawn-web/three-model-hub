import { describe, it, expect } from 'vitest'
import { parseUrlParams } from '../src/communication/url-params'

describe('parseUrlParams', () => {
  it('should parse modelUrl from query string', () => {
    const result = parseUrlParams('?modelUrl=http://example.com/model.glb')
    expect(result.modelUrl).toBe('http://example.com/model.glb')
  })

  it('should parse tools list', () => {
    const result = parseUrlParams('?tools=navigation,picking,measurement')
    expect(result.tools).toEqual(['navigation', 'picking', 'measurement'])
  })

  it('should parse environment preset', () => {
    const result = parseUrlParams('?environment=sunset')
    expect(result.environment).toBe('sunset')
  })

  it('should return defaults when no params', () => {
    const result = parseUrlParams('')
    expect(result.modelUrl).toBeNull()
    expect(result.tools).toEqual([])
    expect(result.environment).toBeNull()
  })

  it('should handle URL-encoded values', () => {
    const result = parseUrlParams('?modelUrl=http%3A%2F%2Fexample.com%2Fmodel.glb')
    expect(result.modelUrl).toBe('http://example.com/model.glb')
  })

  it('should parse toolbar visibility', () => {
    const result = parseUrlParams('?toolbar=false')
    expect(result.toolbarVisible).toBe(false)
  })

  // ── Geo 字段（新增） ─────────────────────────────────────

  describe('imagery 与 geoType', () => {
    it('应解析 imagery 参数', () => {
      expect(parseUrlParams('?imagery=tianditu').imagery).toBe('tianditu')
      expect(parseUrlParams('?imagery=google').imagery).toBe('google')
    })

    it('type= 合法值（satellite/vector/terrain）应解析', () => {
      expect(parseUrlParams('?type=satellite').geoType).toBe('satellite')
      expect(parseUrlParams('?type=vector').geoType).toBe('vector')
      expect(parseUrlParams('?type=terrain').geoType).toBe('terrain')
    })

    it('type= 非法值应返回 undefined', () => {
      expect(parseUrlParams('?type=invalid').geoType).toBeUndefined()
      expect(parseUrlParams('?type=').geoType).toBeUndefined()
    })
  })

  describe('showToolbar 与 showPanel', () => {
    it('toolbar=true 应解析为 showToolbar=true', () => {
      expect(parseUrlParams('?toolbar=true').showToolbar).toBe(true)
    })

    it('toolbar=false 应解析为 showToolbar=false', () => {
      expect(parseUrlParams('?toolbar=false').showToolbar).toBe(false)
    })

    it('panel 参数独立于 toolbar 控制 showPanel', () => {
      expect(parseUrlParams('?toolbar=false&panel=true').showToolbar).toBe(false)
      expect(parseUrlParams('?toolbar=false&panel=true').showPanel).toBe(true)
      expect(parseUrlParams('?toolbar=false&panel=true').toolbarVisible).toBe(false)
    })
  })

  describe('allowedOrigins / hiddenTools / visibleModelIds', () => {
    it('应解析逗号分隔列表', () => {
      expect(parseUrlParams('?allowedOrigins=a.com,b.com').allowedOrigins).toEqual(['a.com', 'b.com'])
      expect(parseUrlParams('?hiddenTools=foo,bar').hiddenTools).toEqual(['foo', 'bar'])
      expect(parseUrlParams('?visibleModelIds=m1,m2,m3').visibleModelIds).toEqual(['m1', 'm2', 'm3'])
    })

    it('应过滤空字符串与空白', () => {
      expect(parseUrlParams('?hiddenTools=foo, ,bar,').hiddenTools).toEqual(['foo', 'bar'])
    })

    it('visibleModelIds 未传时应为 undefined（非 null）', () => {
      expect(parseUrlParams('?').visibleModelIds).toBeUndefined()
    })

    it('visibleModelIds 显式传空值时（?visibleModelIds=）应解析为 []，区分"未设置"和"过滤为空"语义', () => {
      // 之前用 || ?? 错误地把 '' 折叠成 null（视为"不过滤"），
      // 修后 '?visibleModelIds=' = "全部隐藏"，与 undefined（"全部显示"）语义分离
      expect(parseUrlParams('?visibleModelIds=').visibleModelIds).toEqual([])
    })

    it('visibleModelIds 未传时应为 undefined（不过滤）', () => {
      expect(parseUrlParams('?').visibleModelIds).toBeUndefined()
    })
  })

  describe('showMarkers 三态解析', () => {
    it('"true"/"1"/"yes" 应解析为 true', () => {
      expect(parseUrlParams('?showMarkers=true').showMarkers).toBe(true)
      expect(parseUrlParams('?showMarkers=1').showMarkers).toBe(true)
      expect(parseUrlParams('?showMarkers=yes').showMarkers).toBe(true)
    })

    it('"false"/"0"/"no" 应解析为 false', () => {
      expect(parseUrlParams('?showMarkers=false').showMarkers).toBe(false)
      expect(parseUrlParams('?showMarkers=0').showMarkers).toBe(false)
      expect(parseUrlParams('?showMarkers=no').showMarkers).toBe(false)
    })

    it('其他值应返回 undefined（保留默认）', () => {
      expect(parseUrlParams('?showMarkers=maybe').showMarkers).toBeUndefined()
    })

    it('未传时应为 undefined', () => {
      expect(parseUrlParams('?').showMarkers).toBeUndefined()
    })
  })

  describe('camera / viewpoint JSON 解析', () => {
    it('应解析合法 camera JSON', () => {
      const result = parseUrlParams(
        '?camera=' + encodeURIComponent(JSON.stringify({ longitude: 116.4, latitude: 39.9, altitude: 100, heading: 0, pitch: -45 }))
      )
      expect(result.camera).toEqual({ longitude: 116.4, latitude: 39.9, altitude: 100, heading: 0, pitch: -45 })
    })

    it('viewpoint 应作为 camera 的别名', () => {
      const result = parseUrlParams(
        '?viewpoint=' + encodeURIComponent(JSON.stringify({ longitude: 1, latitude: 2, altitude: 3 }))
      )
      expect(result.camera).toEqual({ longitude: 1, latitude: 2, altitude: 3 })
    })

    it('camera 优先于 viewpoint', () => {
      const result = parseUrlParams(
        '?camera=' + encodeURIComponent(JSON.stringify({ longitude: 1, latitude: 2, altitude: 3 })) +
        '&viewpoint=' + encodeURIComponent(JSON.stringify({ longitude: 9, latitude: 9, altitude: 9 }))
      )
      expect(result.camera?.longitude).toBe(1)
    })

    it('缺关键字段（lng/lat/alt）应容错返回 undefined', () => {
      expect(parseUrlParams('?camera=' + encodeURIComponent(JSON.stringify({ longitude: 1 }))).camera).toBeUndefined()
    })

    it('非法 JSON 应容错返回 undefined（不抛错）', () => {
      expect(parseUrlParams('?camera=not-json').camera).toBeUndefined()
      expect(parseUrlParams('?camera={bad').camera).toBeUndefined()
    })

    it('未传时应为 undefined', () => {
      expect(parseUrlParams('?').camera).toBeUndefined()
    })
  })
})
