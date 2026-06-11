import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { InitMultipartDto } from '../init-multipart.dto'

/**
 * InitMultipartDto 验证测试
 *
 * 覆盖：合法值 / 边界值 / 必填校验 / fileSize 超过 1GB 拒绝
 */
describe('InitMultipartDto', () => {
  async function check(input: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(InitMultipartDto, input)
    const errors = await validate(dto)
    return errors.flatMap((e) => Object.values(e.constraints || {}))
  }

  const valid = {
    fileName: 'test.glb',
    fileSize: 8 * 1024 * 1024,
    mimeType: 'model/gltf-binary',
    bizType: 'model',
  }

  it('合法值应通过', async () => {
    expect(await check(valid)).toEqual([])
  })

  it('fileName 为空应拒绝', async () => {
    const errors = await check({ ...valid, fileName: '' })
    expect(errors.some((e) => /文件名/.test(e))).toBe(true)
  })

  it('fileSize 超过 1GB 应拒绝', async () => {
    const errors = await check({ ...valid, fileSize: 2 * 1024 * 1024 * 1024 })
    expect(errors.some((e) => /文件大小不能超过/.test(e))).toBe(true)
  })

  it('fileSize 边界 1MB 应通过', async () => {
    expect(await check({ ...valid, fileSize: 1024 * 1024 })).toEqual([])
  })

  it('bizType 非枚举值应拒绝', async () => {
    const errors = await check({ ...valid, bizType: 'invalid' })
    expect(errors.some((e) => /bizType/.test(e))).toBe(true)
  })

  it('bizType 接受所有 6 种合法值', async () => {
    const types = ['model', 'model-version', 'resource-image', 'resource-video', 'marker-icon', 'thumbnail']
    for (const t of types) {
      expect(await check({ ...valid, bizType: t })).toEqual([])
    }
  })

  it('mimeType 为空应拒绝', async () => {
    const errors = await check({ ...valid, mimeType: '' })
    expect(errors.some((e) => /MIME/.test(e))).toBe(true)
  })

  it('fileSize 为 0 应拒绝', async () => {
    const errors = await check({ ...valid, fileSize: 0 })
    expect(errors.some((e) => /大于 0/.test(e))).toBe(true)
  })
})