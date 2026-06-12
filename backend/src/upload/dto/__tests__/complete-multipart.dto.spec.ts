import { validate, ValidationError } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { CompleteMultipartDto } from '../complete-multipart.dto'

/**
 * 收集所有层级的错误信息（包括嵌套子对象的 constraints）
 */
function collectMessages(errors: ValidationError[]): string[] {
  const out: string[] = []
  for (const e of errors) {
    if (e.constraints) {
      out.push(...Object.values(e.constraints))
    }
    if (e.children && e.children.length > 0) {
      out.push(...collectMessages(e.children))
    }
  }
  return out
}

describe('CompleteMultipartDto', () => {
  async function check(input: Record<string, unknown>): Promise<string[]> {
    // 显式转换嵌套对象
    const dto = plainToInstance(CompleteMultipartDto, input, { enableImplicitConversion: true })
    const errors = await validate(dto)
    return collectMessages(errors)
  }

  const valid = {
    uploadId: 'up-1',
    parts: [
      { partNumber: 1, etag: 'e1' },
      { partNumber: 2, etag: 'e2' },
    ],
  }

  it('合法值应通过', async () => {
    expect(await check(valid)).toEqual([])
  })

  it('uploadId 为空应拒绝', async () => {
    const errors = await check({ ...valid, uploadId: '' })
    expect(errors.some((e) => /uploadId/.test(e))).toBe(true)
  })

  it('parts 为空数组应拒绝', async () => {
    const errors = await check({ ...valid, parts: [] })
    expect(errors.some((e) => /至少包含/.test(e))).toBe(true)
  })

  it('嵌套 partNumber < 1 应拒绝', async () => {
    const errors = await check({
      ...valid,
      parts: [{ partNumber: 0, etag: 'e1' }],
    })
    expect(errors.some((e) => /partNumber/.test(e))).toBe(true)
  })

  it('嵌套 etag 为空应拒绝', async () => {
    const errors = await check({
      ...valid,
      parts: [{ partNumber: 1, etag: '' }],
    })
    expect(errors.some((e) => /etag/.test(e))).toBe(true)
  })
})
