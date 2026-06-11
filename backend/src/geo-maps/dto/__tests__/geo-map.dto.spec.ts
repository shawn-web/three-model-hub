import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import {
  CreateGeoMapDto,
  UpdateGeoMapDto,
  AddGeoMapModelDto,
  UpdateGeoMapModelDto,
  BatchGeoMapModelItemDto,
  BatchUpdateGeoMapModelsDto,
  SaveGeoMapConfigDto,
} from '../geo-map.dto'
import { GeoPositionDto } from '../../../scenes/dto/geo-position.dto'

/** 便捷校验函数：手动转换 geo_position 嵌套对象 */
async function check<T extends object>(Cls: new () => T, input: Record<string, unknown>) {
  const dto = plainToInstance(Cls, input)
  if (dto && 'geo_position' in dto && (dto as any).geo_position && typeof (dto as any).geo_position === 'object') {
    ;(dto as any).geo_position = plainToInstance(GeoPositionDto, (dto as any).geo_position)
  }
  const errors = await validate(dto)
  return errors.flatMap((e) => Object.values(e.constraints || {}))
}

describe('CreateGeoMapDto', () => {
  it('缺少 name 应拒绝', async () => {
    const errors = await check(CreateGeoMapDto, {})
    expect(errors.some((e) => /name/.test(e))).toBe(true)
  })

  it('name 非字符串应拒绝', async () => {
    const errors = await check(CreateGeoMapDto, { name: 123 })
    expect(errors.some((e) => /name/.test(e))).toBe(true)
  })

  it('最小合法值应通过', async () => {
    expect(await check(CreateGeoMapDto, { name: 'test' })).toEqual([])
  })

  it('带 config 对象应通过', async () => {
    expect(await check(CreateGeoMapDto, { name: 'test', config: { foo: 'bar' } })).toEqual([])
  })
})

describe('UpdateGeoMapDto', () => {
  it('全字段可选，空对象应通过', async () => {
    expect(await check(UpdateGeoMapDto, {})).toEqual([])
  })

  it('更新部分字段应通过', async () => {
    expect(await check(UpdateGeoMapDto, { name: 'new-name' })).toEqual([])
    expect(await check(UpdateGeoMapDto, { thumbnail_url: 'https://x.com/y.png' })).toEqual([])
  })

  it('config 非对象应拒绝', async () => {
    const errors = await check(UpdateGeoMapDto, { config: 'not-object' as any })
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('AddGeoMapModelDto', () => {
  it('缺少 model_id 应拒绝', async () => {
    const errors = await check(AddGeoMapModelDto, {})
    expect(errors.some((e) => /model_id/.test(e))).toBe(true)
  })

  it('最小合法值应通过', async () => {
    expect(await check(AddGeoMapModelDto, { model_id: 'm-1' })).toEqual([])
  })

  it('geo_position 为 null 时应跳过嵌套校验（清除定位）', async () => {
    const errors = await check(AddGeoMapModelDto, { model_id: 'm-1', geo_position: null })
    expect(errors).toEqual([])
  })

  it('geo_position 合法值应通过', async () => {
    expect(
      await check(AddGeoMapModelDto, {
        model_id: 'm-1',
        geo_position: { longitude: 116, latitude: 39, altitude: 50 },
      })
    ).toEqual([])
  })

  it('geo_position 越界（longitude=200）应拒绝', async () => {
    // 直接构造嵌套实例以避免 plainToInstance + @Type 隐式转换的兼容问题
    const bad = new GeoPositionDto()
    bad.longitude = 200
    bad.latitude = 39
    bad.altitude = 50
    const dto = new AddGeoMapModelDto()
    dto.model_id = 'm-1'
    dto.geo_position = bad
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('UpdateGeoMapModelDto', () => {
  it('空对象应通过（全 optional）', async () => {
    expect(await check(UpdateGeoMapModelDto, {})).toEqual([])
  })

  it('geo_position: null 应跳过校验', async () => {
    expect(await check(UpdateGeoMapModelDto, { geo_position: null })).toEqual([])
  })

  it('geo_position 越界应拒绝', async () => {
    const bad = new GeoPositionDto()
    bad.longitude = 200
    bad.latitude = 39
    bad.altitude = 50
    const dto = new UpdateGeoMapModelDto()
    dto.geo_position = bad
    expect((await validate(dto)).length).toBeGreaterThan(0)
  })
})

describe('BatchGeoMapModelItemDto', () => {
  it('缺少 id 应拒绝', async () => {
    const errors = await check(BatchGeoMapModelItemDto, { geo_position: null })
    expect(errors.some((e) => /id/.test(e))).toBe(true)
  })

  it('最小合法值应通过', async () => {
    expect(await check(BatchGeoMapModelItemDto, { id: 'm-1' })).toEqual([])
  })

  it('geo_position 越界应拒绝（嵌套校验）', async () => {
    const bad = new GeoPositionDto()
    bad.longitude = 200
    bad.latitude = 39
    bad.altitude = 50
    const dto = new BatchGeoMapModelItemDto()
    dto.id = 'm-1'
    dto.geo_position = bad
    expect((await validate(dto)).length).toBeGreaterThan(0)
  })
})

describe('BatchUpdateGeoMapModelsDto', () => {
  it('空 models 数组应通过（设计上允许空数组，对应"仅保存配置"场景）', async () => {
    expect(await check(BatchUpdateGeoMapModelsDto, { models: [] })).toEqual([])
  })

  it('models 超过 100 应拒绝', async () => {
    const models = Array.from({ length: 101 }, (_, i) => ({ id: `m-${i}` }))
    const errors = await check(BatchUpdateGeoMapModelsDto, { models })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('models 中某个 item 缺 id 应通过数组级校验但 item 自身失败', async () => {
    const dto = plainToInstance(BatchUpdateGeoMapModelsDto, { models: [{ id: 'm-1' }, {}] })
    // 手动转换嵌套 item
    if (dto && Array.isArray((dto as any).models)) {
      ;(dto as any).models = (dto as any).models.map((m: any) =>
        m && m.id ? plainToInstance(BatchGeoMapModelItemDto, m) : m
      )
    }
    const errors = await validate(dto)
    // 嵌套校验应至少报告 1 条错误
    const allMessages = JSON.stringify(errors)
    expect(allMessages).toMatch(/id/)
  })

  it('100 个合法 items 应通过', async () => {
    const models = Array.from({ length: 100 }, (_, i) => ({ id: `m-${i}` }))
    expect(await check(BatchUpdateGeoMapModelsDto, { models })).toEqual([])
  })
})

describe('SaveGeoMapConfigDto', () => {
  it('缺少 models 应拒绝', async () => {
    const errors = await check(SaveGeoMapConfigDto, {})
    expect(errors.some((e) => /models/.test(e))).toBe(true)
  })

  it('空 models 数组应通过（设计上允许，对应"仅保存底图配置"场景）', async () => {
    expect(await check(SaveGeoMapConfigDto, { models: [] })).toEqual([])
  })

  it('带 geoConfig 对象应通过', async () => {
    expect(
      await check(SaveGeoMapConfigDto, {
        models: [{ id: 'm-1' }],
        geoConfig: { imageryProvider: 'tianditu' },
      })
    ).toEqual([])
  })

  it('超过 100 个 models 应拒绝', async () => {
    const models = Array.from({ length: 101 }, (_, i) => ({ id: `m-${i}` }))
    const errors = await check(SaveGeoMapConfigDto, { models })
    expect(errors.length).toBeGreaterThan(0)
  })
})
