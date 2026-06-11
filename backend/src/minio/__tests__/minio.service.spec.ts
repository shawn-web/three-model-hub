import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { MinioService } from '../minio.service'

/**
 * MinioService 单元测试
 *
 * Mock 策略：jest.mock('minio', () => ({ Client: jest.fn() }))
 *   - 这里直接在测试中构造 mock 实例并注入到 ConfigService 中
 *   - 真实场景下 Client 在 onModuleInit 中构造
 */
describe('MinioService', () => {
  let service: MinioService
  let mockClient: any

  // 通用 ConfigService stub
  const makeConfig = (overrides: Record<string, string> = {}) => ({
    get: (key: string, def?: any) => {
      const map: Record<string, string> = {
        MINIO_ENDPOINT: 'localhost',
        MINIO_PORT: '9000',
        MINIO_USE_SSL: 'false',
        MINIO_ACCESS_KEY: 'minioadmin',
        MINIO_SECRET_KEY: 'minioadmin',
        MINIO_BUCKET: 'three-mode',
        MINIO_PUBLIC_URL: 'http://localhost:9000',
        MINIO_REGION: 'us-east-1',
        ...overrides,
      }
      return key in map ? map[key] : def
    },
  })

  beforeEach(async () => {
    mockClient = {
      bucketExists: jest.fn(),
      makeBucket: jest.fn(),
      getBucketPolicy: jest.fn(),
      setBucketPolicy: jest.fn(),
      putObject: jest.fn(),
      initiateNewMultipartUpload: jest.fn(),
      uploadPart: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      listParts: jest.fn(),
      removeObject: jest.fn(),
      statObject: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        { provide: ConfigService, useValue: makeConfig() },
      ],
    }).compile()

    service = module.get<MinioService>(MinioService)
    // 直接注入 mock client 替代真实构造
    ;(service as any).client = mockClient
  })

  describe('onModuleInit', () => {
    it('bucket 不存在时应创建（保持私有，访问走 NestJS 代理）', async () => {
      mockClient.bucketExists.mockResolvedValue(false)

      await service.onModuleInit()

      expect(mockClient.bucketExists).toHaveBeenCalledWith('three-mode')
      expect(mockClient.makeBucket).toHaveBeenCalledWith('three-mode', 'us-east-1')
      // 安全要求：不应设置任何 s3:GetObject 匿名读策略
      expect(mockClient.setBucketPolicy).not.toHaveBeenCalled()
    })

    it('bucket 已存在时应跳过创建且不设策略', async () => {
      mockClient.bucketExists.mockResolvedValue(true)

      await service.onModuleInit()

      expect(mockClient.makeBucket).not.toHaveBeenCalled()
      expect(mockClient.setBucketPolicy).not.toHaveBeenCalled()
    })
  })

  describe('putObject', () => {
    it('应透传 key/buffer/mime 给 client.putObject', async () => {
      mockClient.putObject.mockResolvedValue({ etag: 'abc' })

      await service.putObject('labs/test.glb', Buffer.from('data'), 'model/gltf-binary')

      expect(mockClient.putObject).toHaveBeenCalledWith(
        'three-mode',
        'labs/test.glb',
        expect.any(Buffer),
        4,
        { 'Content-Type': 'model/gltf-binary' },
      )
    })
  })

  describe('initMultipart', () => {
    it('应返回 MinIO 给的 uploadId', async () => {
      // minio 8.x：initiateNewMultipartUpload 直接返回 Promise<string>
      mockClient.initiateNewMultipartUpload.mockResolvedValue('up-123')

      const uploadId = await service.initMultipart('labs/test.glb')

      expect(uploadId).toBe('up-123')
      expect(mockClient.initiateNewMultipartUpload).toHaveBeenCalledWith(
        'three-mode',
        'labs/test.glb',
        {},
      )
    })
  })

  describe('uploadPart', () => {
    it('应返回 ETag', async () => {
      mockClient.uploadPart.mockResolvedValue({ etag: 'etag-1', key: 'labs/test.glb', part: 1 })

      const etag = await service.uploadPart('up-1', 'labs/test.glb', 1, Buffer.from('p'))

      expect(etag).toBe('etag-1')
      // minio 8.x：uploadPart 接收单对象参数 { bucketName, objectName, uploadID, partNumber, headers }
      expect(mockClient.uploadPart).toHaveBeenCalledWith(
        expect.objectContaining({
          bucketName: 'three-mode',
          objectName: 'labs/test.glb',
          uploadID: 'up-1',
          partNumber: 1,
        }),
        expect.any(Buffer),
      )
    })
  })

  describe('completeMultipart', () => {
    it('应将 partNumber 转换为 part 字段并透传', async () => {
      mockClient.completeMultipartUpload.mockResolvedValue({ etag: 'final', versionId: null })

      const parts = [
        { partNumber: 1, etag: 'e1' },
        { partNumber: 2, etag: 'e2' },
      ]
      const result = await service.completeMultipart('up-1', 'labs/test.glb', parts)

      expect(result.etag).toBe('final')
      // minio 8.x：etags 字段名是 `part`
      expect(mockClient.completeMultipartUpload).toHaveBeenCalledWith(
        'three-mode',
        'labs/test.glb',
        'up-1',
        [
          { part: 1, etag: 'e1' },
          { part: 2, etag: 'e2' },
        ],
      )
    })
  })

  describe('abortMultipart', () => {
    it('应调 client.abortMultipartUpload', async () => {
      mockClient.abortMultipartUpload.mockResolvedValue(undefined)

      await service.abortMultipart('up-1', 'labs/test.glb')

      expect(mockClient.abortMultipartUpload).toHaveBeenCalledWith(
        'three-mode',
        'labs/test.glb',
        'up-1',
      )
    })

    it('失败时仅 warn 不抛错', async () => {
      mockClient.abortMultipartUpload.mockRejectedValue(new Error('boom'))

      await expect(service.abortMultipart('up-1', 'labs/test.glb')).resolves.toBeUndefined()
    })
  })

  describe('listParts', () => {
    it('minio 8.x 无公开 listParts API，应返回空数组（断点续传以 session.uploaded_parts 为准）', async () => {
      const parts = await service.listParts('up-1', 'labs/test.glb')

      expect(parts).toEqual([])
    })
  })

  describe('removeObject', () => {
    it('应调 client.removeObject', async () => {
      mockClient.removeObject.mockResolvedValue(undefined)

      await service.removeObject('labs/test.glb')

      expect(mockClient.removeObject).toHaveBeenCalledWith('three-mode', 'labs/test.glb')
    })

    it('失败时仅 warn 不抛错', async () => {
      mockClient.removeObject.mockRejectedValue(new Error('boom'))

      await expect(service.removeObject('labs/test.glb')).resolves.toBeUndefined()
    })
  })

  describe('statObject', () => {
    it('应返回 size/lastModified/etag', async () => {
      const d = new Date('2026-06-09T10:00:00Z')
      mockClient.statObject.mockResolvedValue({ size: 1024, lastModified: d, etag: 'e1' })

      const stat = await service.statObject('labs/test.glb')

      expect(stat).toEqual({ size: 1024, lastModified: d, etag: 'e1' })
    })
  })

  describe('getPublicUrl', () => {
    it('应返回 NestJS 代理相对路径 /api/storage/{bucket}/{key}', () => {
      // 注：tapp → MinIO 重构后统一走 /api/storage 代理，
      //     避免浏览器跨域访问对象存储，前端只与 5173/3000 同源
      expect(service.getPublicUrl('labs/test.glb')).toBe('/api/storage/three-mode/labs/test.glb')
    })
    it('空 key 应返回空字符串', () => {
      expect(service.getPublicUrl('')).toBe('')
    })
  })

  describe('getBucket', () => {
    it('应返回 bucket 名', () => {
      expect(service.getBucket()).toBe('three-mode')
    })
  })
})
