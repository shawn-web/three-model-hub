import { Test, TestingModule } from '@nestjs/testing'
import { StorageService } from '../storage.service'
import { MinioService } from '../../minio/minio.service'

/**
 * StorageService 单元测试
 *
 * 覆盖：
 *   - generateObjectKey 6 种 bizType 各自映射
 *   - verifyObject 成功/失败
 *   - getPublicUrl 透传
 *   - uploadFile 调 minioService.putObject
 *   - deleteFile 调 minioService.removeObject
 */
describe('StorageService', () => {
  let service: StorageService

  const mockMinioService = {
    putObject: jest.fn(),
    removeObject: jest.fn(),
    statObject: jest.fn(),
    getPublicUrl: jest.fn(),
    getBucket: jest.fn().mockReturnValue('three-mode'),
  } as unknown as jest.Mocked<MinioService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile()

    service = module.get<StorageService>(StorageService)
    // mockClear 只重置调用记录，不删除 mock 实现
    jest.mocked(mockMinioService.putObject).mockClear()
    jest.mocked(mockMinioService.removeObject).mockClear()
    jest.mocked(mockMinioService.statObject).mockClear()
    jest.mocked(mockMinioService.getPublicUrl).mockClear()
  })

  describe('generateObjectKey', () => {
    it.each([
      ['model', 'foo.glb', /^labs\/models\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.glb$/],
      ['model-version', 'foo.glb', /^labs\/models\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.glb$/],
      ['resource-image', 'foo.png', /^labs\/images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/],
      ['resource-video', 'foo.mp4', /^labs\/videos\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.mp4$/],
      ['marker-icon', 'foo.png', /^labs\/icons\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/],
      ['thumbnail', 'foo.png', /^labs\/thumbnails\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/],
    ])('bizType=%s fileName=%s 应生成正确的 objectKey', (bizType, fileName, re) => {
      const key = service.generateObjectKey(bizType, fileName)
      expect(key).toMatch(re)
    })

    it('未知 bizType 应兜底 labs/misc', () => {
      const key = service.generateObjectKey('unknown', 'foo.bin')
      expect(key).toMatch(/^labs\/misc\//)
    })

    it('无扩展名时应补 .bin', () => {
      const key = service.generateObjectKey('model', 'noext')
      expect(key.endsWith('.bin')).toBe(true)
    })
  })

  describe('verifyObject', () => {
    it('MinIO 抛错时应返回 { exists: false }', async () => {
      mockMinioService.statObject.mockRejectedValue(new Error('not found'))
      const result = await service.verifyObject('labs/missing.glb')
      expect(result).toEqual({ exists: false })
    })

    it('MinIO 成功时应返回 { exists: true, size }', async () => {
      mockMinioService.statObject.mockResolvedValue({
        size: 1024,
        lastModified: new Date(),
        etag: 'e1',
      })
      const result = await service.verifyObject('labs/test.glb')
      expect(result).toEqual({ exists: true, size: 1024 })
    })

    it('fileKey 为空时直接返回 { exists: false }', async () => {
      const result = await service.verifyObject('')
      expect(result).toEqual({ exists: false })
      expect(mockMinioService.statObject).not.toHaveBeenCalled()
    })
  })

  describe('getPublicUrl', () => {
    it('应透传 minioService.getPublicUrl', () => {
      mockMinioService.getPublicUrl.mockReturnValue('http://localhost:9000/three-mode/labs/test.glb')
      const url = service.getPublicUrl('labs/test.glb')
      expect(url).toBe('http://localhost:9000/three-mode/labs/test.glb')
    })
  })

  describe('uploadFile', () => {
    it('应调 minioService.putObject 并返回 { url, fileKey }', async () => {
      mockMinioService.putObject.mockResolvedValue(undefined)
      mockMinioService.getPublicUrl.mockReturnValue('http://localhost:9000/three-mode/labs/models/x/y/uuid.glb')

      const result = await service.uploadFile(
        Buffer.from('data'),
        'test.glb',
        undefined,
        undefined,
        'labs/models',
      )

      expect(mockMinioService.putObject).toHaveBeenCalled()
      expect(result.fileKey).toMatch(/^labs\/models\//)
      expect(result.url).toContain('three-mode')
    })

    it('onProgress 回调应被调用一次 100%', async () => {
      const cb = jest.fn()
      mockMinioService.putObject.mockResolvedValue(undefined)
      mockMinioService.getPublicUrl.mockReturnValue('http://x')

      await service.uploadFile(Buffer.from('a'), 'a.glb', undefined, cb, 'labs/models')
      expect(cb).toHaveBeenCalledWith(100)
    })
  })

  describe('deleteFile', () => {
    it('应调 minioService.removeObject', async () => {
      mockMinioService.removeObject.mockResolvedValue(undefined)
      await service.deleteFile('labs/test.glb')
      expect(mockMinioService.removeObject).toHaveBeenCalledWith('labs/test.glb')
    })

    it('fileKey 为空时不应调 removeObject', async () => {
      await service.deleteFile('')
      expect(mockMinioService.removeObject).not.toHaveBeenCalled()
    })
  })

  describe('calculateHash', () => {
    it('应返回 Buffer 的 SHA256 hex', () => {
      const hash = service.calculateHash(Buffer.from('hello'))
      // SHA256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    })
  })

  describe('detectFormat', () => {
    it('应返回小写扩展名（不带点）', () => {
      expect(service.detectFormat('foo.GLB')).toBe('glb')
      expect(service.detectFormat('foo.glb')).toBe('glb')
      expect(service.detectFormat('foo')).toBe('glb') // 默认 glb
    })
  })
})
