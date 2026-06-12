import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { SaveGeoConfigDto } from '../save-geo-config.dto'
import {
  AddSceneModelDto,
  UpdateSceneModelDto,
  BatchSceneModelItemDto,
  BatchUpdateSceneModelsDto,
} from '../scene.dto'
import { GeoPositionDto } from '../geo-position.dto'

/**
 * 校验函数：手动将 geo_position 子对象转换为 GeoPositionDto 实例，
 * 避免依赖 plainToInstance 对 @Type 装饰器的隐式转换。
 */
async function check<T extends object>(Cls: new () => T, input: Record<string, unknown>) {
  const dto = plainToInstance(Cls, input)
  // 手动转换 geo_position 为 GeoPositionDto 实例（绕过 plainToInstance 的 @Type 限制）
  if (dto && 'geo_position' in dto && (dto as any).geo_position && typeof (dto as any).geo_position === 'object') {
    ;(dto as any).geo_position = plainToInstance(GeoPositionDto, (dto as any).geo_position)
  }
  const errors = await validate(dto)
  return errors.flatMap((e) => Object.values(e.constraints || {}))
}

describe('SaveGeoConfigDto', () => {
  it('models 为空数组应拒绝（@ArrayMinSize(1)）', async () => {
    const errors = await check(SaveGeoConfigDto, { models: [] })
    expect(errors.some((e) => /models/.test(e))).toBe(true)
  })

  it('models 超过 100 应拒绝（@ArrayMaxSize(100)）', async () => {
    const models = Array.from({ length: 101 }, (_, i) => ({ id: `m-${i}` }))
    const errors = await check(SaveGeoConfigDto, { models })
    expect(errors.some((e) => /models/.test(e))).toBe(true)
  })

  it('最小合法值应通过', async () => {
    expect(await check(SaveGeoConfigDto, { models: [{ id: 'm-1' }] })).toEqual([])
  })

  it('geoConfig 可选；带对象应通过', async () => {
    expect(
      await check(SaveGeoConfigDto, {
        models: [{ id: 'm-1' }],
        geoConfig: { imageryType: 'vector' },
      })
    ).toEqual([])
  })
})

describe('AddSceneModelDto / UpdateSceneModelDto / BatchSceneModelItemDto（geo_position 字段）', () => {
  describe('geo_position 字段', () => {
    it('@ValidateIf：geo_position=null 应跳过校验', async () => {
      expect(await check(AddSceneModelDto, { model_id: 'm-1', geo_position: null })).toEqual([])
      expect(await check(UpdateSceneModelDto, { geo_position: null })).toEqual([])
      expect(await check(BatchSceneModelItemDto, { id: 'm-1', geo_position: null })).toEqual([])
    })

    it('@ValidateIf：geo_position 缺省应跳过校验', async () => {
      expect(await check(AddSceneModelDto, { model_id: 'm-1' })).toEqual([])
      expect(await check(UpdateSceneModelDto, {})).toEqual([])
      expect(await check(BatchSceneModelItemDto, { id: 'm-1' })).toEqual([])
    })

    it('geo_position 合法对象应通过', async () => {
      const valid = { longitude: 116, latitude: 39, altitude: 50 }
      expect(await check(AddSceneModelDto, { model_id: 'm-1', geo_position: valid })).toEqual([])
      expect(await check(UpdateSceneModelDto, { geo_position: valid })).toEqual([])
      expect(await check(BatchSceneModelItemDto, { id: 'm-1', geo_position: valid })).toEqual([])
    })

    it('geo_position 越界对象应拒绝（@ValidateNested 生效）', async () => {
      // 直接构造嵌套实例以避免 plainToInstance + @Type 隐式转换的兼容问题
      const bad = new GeoPositionDto()
      bad.longitude = 200
      bad.latitude = 39
      bad.altitude = 50

      const dto1 = new AddSceneModelDto()
      dto1.model_id = 'm-1'
      dto1.geo_position = bad
      expect((await validate(dto1)).length).toBeGreaterThan(0)

      const dto2 = new UpdateSceneModelDto()
      dto2.geo_position = bad
      expect((await validate(dto2)).length).toBeGreaterThan(0)

      const dto3 = new BatchSceneModelItemDto()
      dto3.id = 'm-1'
      dto3.geo_position = bad
      expect((await validate(dto3)).length).toBeGreaterThan(0)
    })
  })

  describe('其他字段', () => {
    it('AddSceneModelDto 缺少 model_id 应拒绝', async () => {
      const errors = await check(AddSceneModelDto, {})
      expect(errors.some((e) => /model_id/.test(e))).toBe(true)
    })

    it('BatchSceneModelItemDto 缺少 id 应拒绝', async () => {
      const errors = await check(BatchSceneModelItemDto, {})
      expect(errors.some((e) => /id/.test(e))).toBe(true)
    })
  })
})

describe('BatchUpdateSceneModelsDto', () => {
  it('models 为空数组应拒绝（@ArrayMinSize(1)）', async () => {
    const errors = await check(BatchUpdateSceneModelsDto, { models: [] })
    expect(errors.some((e) => /models/.test(e))).toBe(true)
  })

  it('超过 100 项应拒绝', async () => {
    const models = Array.from({ length: 101 }, (_, i) => ({ id: `m-${i}` }))
    const errors = await check(BatchUpdateSceneModelsDto, { models })
    expect(errors.some((e) => /models/.test(e))).toBe(true)
  })

  it('100 项合法应通过', async () => {
    const models = Array.from({ length: 100 }, (_, i) => ({ id: `m-${i}` }))
    expect(await check(BatchUpdateSceneModelsDto, { models })).toEqual([])
  })
})
