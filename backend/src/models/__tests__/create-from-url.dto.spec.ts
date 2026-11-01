import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { CreateFromUrlDto } from '../dto/model.dto'
import { DEFAULT_MINIO_BUCKET } from '../../minio/constants'

/**
 * CreateFromUrlDto 验证测试
 *
 * 覆盖：file_size 不能超过 1GB
 */
describe('CreateFromUrlDto', () => {
  async function check(input: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(CreateFromUrlDto, input)
    const errors = await validate(dto)
    return errors.flatMap((e) => Object.values(e.constraints || {}))
  }

  const valid = {
    name: 'test',
    file_url: `http://localhost:9000/${DEFAULT_MINIO_BUCKET}/labs/models/x.glb`,
    file_name: 'x.glb',
    file_size: 1024,
    file_key: 'labs/models/x.glb',
  }

  it('合法值应通过', async () => {
    expect(await check(valid)).toEqual([])
  })

  it('file_size 1GB 边界值应通过', async () => {
    const errors = await check({ ...valid, file_size: 1024 * 1024 * 1024 })
    expect(errors).toEqual([])
  })

  it('file_size 1GB+1 应拒绝', async () => {
    const errors = await check({ ...valid, file_size: 1024 * 1024 * 1024 + 1 })
    expect(errors.some((e) => /文件大小不能超过/.test(e))).toBe(true)
  })

  it('file_size 为 0 应拒绝', async () => {
    const errors = await check({ ...valid, file_size: 0 })
    expect(errors.some((e) => /大于 0/.test(e))).toBe(true)
  })

  it('file_key 缺失应拒绝', async () => {
    const errors = await check({ ...valid, file_key: undefined })
    expect(errors.some((e) => /file_key/.test(e))).toBe(true)
  })
})
