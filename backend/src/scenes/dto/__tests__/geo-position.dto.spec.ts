import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { GeoPositionDto } from '../geo-position.dto'

/**
 * GeoPositionDto 边界用例：经度、纬度、heading、pitch、roll、scale
 * 参考 WGS84 坐标系统与 class-validator 语义
 */
describe('GeoPositionDto', () => {
  const valid = {
    longitude: 116.4,
    latitude: 39.9,
    altitude: 50,
  }

  async function check(input: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(GeoPositionDto, input)
    const errors = await validate(dto)
    return errors.flatMap((e) => Object.values(e.constraints || {}))
  }

  it('最小合法值（仅必填字段）应通过校验', async () => {
    expect(await check(valid)).toEqual([])
  })

  describe('longitude [-180, 180]', () => {
    it('-180 / 180 边界值应通过', async () => {
      expect(await check({ ...valid, longitude: -180 })).toEqual([])
      expect(await check({ ...valid, longitude: 180 })).toEqual([])
    })

    it('-180.001 / 180.001 边界外应拒绝', async () => {
      const errors1 = await check({ ...valid, longitude: -180.001 })
      const errors2 = await check({ ...valid, longitude: 180.001 })
      expect(errors1.some((e) => /longitude/.test(e))).toBe(true)
      expect(errors2.some((e) => /longitude/.test(e))).toBe(true)
    })

    it('非数字类型应拒绝', async () => {
      expect(await check({ ...valid, longitude: 'abc' as any })).not.toEqual([])
    })
  })

  describe('latitude [-90, 90]', () => {
    it('-90 / 90 边界值应通过', async () => {
      expect(await check({ ...valid, latitude: -90 })).toEqual([])
      expect(await check({ ...valid, latitude: 90 })).toEqual([])
    })

    it('-90.001 / 90.001 边界外应拒绝', async () => {
      const errors1 = await check({ ...valid, latitude: -90.001 })
      const errors2 = await check({ ...valid, latitude: 90.001 })
      expect(errors1.some((e) => /latitude/.test(e))).toBe(true)
      expect(errors2.some((e) => /latitude/.test(e))).toBe(true)
    })
  })

  describe('altitude（无范围限制）', () => {
    it('任意数值（含负值与极大值）应通过', async () => {
      expect(await check({ ...valid, altitude: -1000 })).toEqual([])
      expect(await check({ ...valid, altitude: 100000 })).toEqual([])
      expect(await check({ ...valid, altitude: 0 })).toEqual([])
    })
  })

  describe('heading [0, 360]', () => {
    it('0 / 360 边界值应通过', async () => {
      expect(await check({ ...valid, heading: 0 })).toEqual([])
      expect(await check({ ...valid, heading: 360 })).toEqual([])
    })

    it('-0.001 / 360.001 应拒绝', async () => {
      const errors1 = await check({ ...valid, heading: -0.001 })
      const errors2 = await check({ ...valid, heading: 360.001 })
      expect(errors1.some((e) => /heading/.test(e))).toBe(true)
      expect(errors2.some((e) => /heading/.test(e))).toBe(true)
    })
  })

  describe('pitch [-90, 90]', () => {
    it('-90 / 90 边界值应通过', async () => {
      expect(await check({ ...valid, pitch: -90 })).toEqual([])
      expect(await check({ ...valid, pitch: 90 })).toEqual([])
    })

    it('-90.001 / 90.001 应拒绝', async () => {
      const errors1 = await check({ ...valid, pitch: -90.001 })
      const errors2 = await check({ ...valid, pitch: 90.001 })
      expect(errors1.some((e) => /pitch/.test(e))).toBe(true)
      expect(errors2.some((e) => /pitch/.test(e))).toBe(true)
    })
  })

  describe('roll [-180, 180]', () => {
    it('-180 / 180 边界值应通过', async () => {
      expect(await check({ ...valid, roll: -180 })).toEqual([])
      expect(await check({ ...valid, roll: 180 })).toEqual([])
    })

    it('-180.001 / 180.001 应拒绝', async () => {
      const errors1 = await check({ ...valid, roll: -180.001 })
      const errors2 = await check({ ...valid, roll: 180.001 })
      expect(errors1.some((e) => /roll/.test(e))).toBe(true)
      expect(errors2.some((e) => /roll/.test(e))).toBe(true)
    })
  })

  describe('scale > 0.001', () => {
    it('0.001 最小值应通过', async () => {
      expect(await check({ ...valid, scale: 0.001 })).toEqual([])
    })

    it('0 / 负值应拒绝', async () => {
      const errors0 = await check({ ...valid, scale: 0 })
      const errorsNeg = await check({ ...valid, scale: -1 })
      expect(errors0.some((e) => /scale/.test(e))).toBe(true)
      expect(errorsNeg.some((e) => /scale/.test(e))).toBe(true)
    })

    it('0.0009（小于 0.001）应拒绝', async () => {
      const errors = await check({ ...valid, scale: 0.0009 })
      expect(errors.some((e) => /scale/.test(e))).toBe(true)
    })
  })

  it('可选项未传时不应报错', async () => {
    const dto = plainToInstance(GeoPositionDto, valid)
    const errors = await validate(dto)
    expect(errors).toEqual([])
  })
})
