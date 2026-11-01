import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { UploadController } from '../upload.controller'
import { UploadService } from '../upload.service'

/**
 * 上传管理控制器单元测试
 *
 * 覆盖路由：
 *   POST /upload/simple             简单上传
 *   POST /upload/multipart/init     初始化分片上传
 *   POST /upload/multipart/part     上传单个分片
 *   POST /upload/multipart/complete 合并分片
 *   POST /upload/multipart/abort    取消上传
 *   GET  /upload/multipart/status   查询上传状态
 */
describe('UploadController', () => {
  let controller: UploadController
  let service: jest.Mocked<UploadService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: {
            uploadSimple: jest.fn(),
            initMultipart: jest.fn(),
            uploadPart: jest.fn(),
            completeMultipart: jest.fn(),
            abort: jest.fn(),
            status: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get(UploadController)
    service = module.get(UploadService)
  })

  describe('POST /upload/simple', () => {
    it('应调用 uploadSimple 并返回结果', async () => {
      const file = { buffer: Buffer.from('data'), originalname: 'test.glb', size: 4 } as any
      const mockResult = { url: 'https://x.com/test.glb', fileKey: 'k1', fileSize: 4 }
      service.uploadSimple.mockResolvedValue(mockResult as any)

      const result = await controller.uploadSimple(file, 'model')

      expect(service.uploadSimple).toHaveBeenCalledWith(file, 'model')
      expect(result).toBe(mockResult)
    })

    it('缺少 file 应抛出 BadRequestException', async () => {
      await expect(controller.uploadSimple(null as any, 'model')).rejects.toThrow(BadRequestException)
    })

    it('缺少 bizType 应抛出 BadRequestException', async () => {
      const file = { buffer: Buffer.from('data') } as any
      await expect(controller.uploadSimple(file, '')).rejects.toThrow(BadRequestException)
    })
  })

  describe('POST /upload/multipart/init', () => {
    it('应调用 initMultipart', async () => {
      const dto = { fileName: 'big.glb', fileSize: 100000000 }
      const mockResult = { uploadId: 'u1', objectKey: 'k1', partSize: 8388608 }
      service.initMultipart.mockResolvedValue(mockResult as any)

      const result = await controller.initMultipart(dto as any)

      expect(service.initMultipart).toHaveBeenCalledWith(dto)
      expect(result).toBe(mockResult)
    })
  })

  describe('POST /upload/multipart/part', () => {
    it('应调用 uploadPart', async () => {
      const buffer = Buffer.from('part-data')
      const mockResult = { partNumber: 1, etag: 'etag1' }
      service.uploadPart.mockResolvedValue(mockResult as any)

      const result = await controller.uploadPart({ buffer, size: buffer.length } as any, { uploadId: 'u1', partNumber: 1 } as any)

      expect(service.uploadPart).toHaveBeenCalledWith('u1', 1, buffer)
      expect(result).toBe(mockResult)
    })

    it('缺少 file 应抛出 BadRequestException', async () => {
      await expect(controller.uploadPart(null as any, { uploadId: 'u1', partNumber: 1 } as any)).rejects.toThrow(BadRequestException)
    })

    it('空 buffer 应抛出 BadRequestException', async () => {
      await expect(controller.uploadPart({ buffer: Buffer.alloc(0) } as any, { uploadId: 'u1', partNumber: 1 } as any)).rejects.toThrow(BadRequestException)
    })
  })

  describe('POST /upload/multipart/complete', () => {
    it('应调用 completeMultipart', async () => {
      const dto = { uploadId: 'u1', parts: [{ partNumber: 1, etag: 'e1' }] }
      const mockResult = { url: 'https://x.com/big.glb', fileKey: 'k1', fileSize: 100000000 }
      service.completeMultipart.mockResolvedValue(mockResult as any)

      const result = await controller.completeMultipart(dto as any)

      expect(service.completeMultipart).toHaveBeenCalledWith(dto)
      expect(result).toBe(mockResult)
    })
  })

  describe('POST /upload/multipart/abort', () => {
    it('应调用 abort', async () => {
      const dto = { uploadId: 'u1' }
      service.abort.mockResolvedValue({ success: true })

      const result = await controller.abort(dto as any)

      expect(service.abort).toHaveBeenCalledWith('u1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('GET /upload/multipart/status', () => {
    it('应调用 status', async () => {
      const mockResult = { objectKey: 'k1', fileSize: 100000000, uploadedParts: [1, 2] }
      service.status.mockResolvedValue(mockResult as any)

      const result = await controller.status('u1')

      expect(service.status).toHaveBeenCalledWith('u1')
      expect(result).toBe(mockResult)
    })

    it('缺少 uploadId 应抛出 BadRequestException', async () => {
      await expect(controller.status('')).rejects.toThrow(BadRequestException)
    })
  })
})
