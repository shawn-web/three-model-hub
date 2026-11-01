import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { StorageController } from '../storage.controller'
import { MinioService } from '../../minio/minio.service'

/**
 * 对象存储代理控制器单元测试
 *
 * 覆盖路由：
 *   GET /storage/:bucket       列出 bucket 文件
 *   GET /storage/:bucket/*     代理下载文件（含 Range 请求）
 */
describe('StorageController', () => {
  let controller: StorageController
  let minioService: jest.Mocked<MinioService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: MinioService,
          useValue: {
            getBucket: jest.fn().mockReturnValue('three-mode'),
            listObjects: jest.fn(),
            statObject: jest.fn(),
            getObjectStream: jest.fn(),
            getObjectPartial: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get(StorageController)
    minioService = module.get(MinioService)
  })

  describe('GET /storage/:bucket (listFiles)', () => {
    it('正确 bucket 应返回文件列表', async () => {
      minioService.listObjects.mockResolvedValue([
        { name: 'labs/models/a.glb', size: 1024, lastModified: new Date('2026-01-01') },
      ])

      const result = await controller.listFiles('three-mode', 'labs/models')

      expect(minioService.listObjects).toHaveBeenCalledWith('labs/models')
      expect(result.bucket).toBe('three-mode')
      expect(result.total).toBe(1)
      expect(result.objects[0]).toEqual({
        key: 'labs/models/a.glb',
        size: 1024,
        lastModified: new Date('2026-01-01'),
        url: '/api/storage/three-mode/labs/models/a.glb',
      })
    })

    it('错误 bucket 应抛出 NotFoundException', async () => {
      await expect(controller.listFiles('other-bucket')).rejects.toThrow(NotFoundException)
    })
  })

  describe('GET /storage/:bucket/* (proxy)', () => {
    let mockReq: any
    let mockRes: any

    beforeEach(() => {
      mockReq = { originalUrl: '/api/storage/three-mode/labs/models/a.glb', url: '/api/storage/three-mode/labs/models/a.glb', headers: {}, range: () => [] }
      mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn(),
        writableEnded: false,
        headersSent: false,
      }
    })

    it('错误 bucket 应抛出 NotFoundException', async () => {
      mockReq.originalUrl = '/api/storage/other-bucket/labs/a.glb'
      mockReq.url = '/api/storage/other-bucket/labs/a.glb'

      await expect(controller.proxy('other-bucket', mockReq as Request, mockRes as Response)).rejects.toThrow(NotFoundException)
    })

    it('URL 格式错误应抛出 BadRequestException', async () => {
      mockReq.originalUrl = '/wrong/prefix/labs/a.glb'
      mockReq.url = '/wrong/prefix/labs/a.glb'

      await expect(controller.proxy('three-mode', mockReq as Request, mockRes as Response)).rejects.toThrow(BadRequestException)
    })

    it('objectKey 为空应抛出 BadRequestException', async () => {
      mockReq.originalUrl = '/api/storage/three-mode/'
      mockReq.url = '/api/storage/three-mode/'

      await expect(controller.proxy('three-mode', mockReq as Request, mockRes as Response)).rejects.toThrow(BadRequestException)
    })

    it('无 Range 请求应流式返回文件', async () => {
      const mockStream = { pipe: jest.fn(), on: jest.fn() }
      minioService.getObjectStream.mockResolvedValue({
        stream: mockStream as any,
        size: 1024,
        contentType: 'model/gltf-binary',
        etag: 'etag1',
        lastModified: new Date('2026-01-01'),
      })

      await controller.proxy('three-mode', mockReq as Request, mockRes as Response)

      expect(minioService.getObjectStream).toHaveBeenCalledWith('labs/models/a.glb')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'model/gltf-binary')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', '1024')
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes)
    })

    it('MinIO NotFound 错误应转为 NotFoundException', async () => {
      minioService.getObjectStream.mockRejectedValue({ code: 'NotFound' })

      await expect(controller.proxy('three-mode', mockReq as Request, mockRes as Response)).rejects.toThrow(NotFoundException)
    })

    it('带 Range 请求应返回 206 部分内容', async () => {
      mockReq.headers.range = 'bytes=0-99'
      mockReq.range = jest.fn().mockReturnValue([{ start: 0, end: 99 }])

      minioService.statObject.mockResolvedValue({ size: 1024, contentType: 'model/gltf-binary', etag: 'etag1', lastModified: new Date('2026-01-01') })
      minioService.getObjectPartial.mockResolvedValue(Buffer.alloc(100))

      await controller.proxy('three-mode', mockReq as Request, mockRes as Response)

      expect(minioService.statObject).toHaveBeenCalledWith('labs/models/a.glb')
      expect(minioService.getObjectPartial).toHaveBeenCalledWith('labs/models/a.glb', 0, 100)
      expect(mockRes.status).toHaveBeenCalledWith(206)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes 0-99/1024')
      expect(mockRes.end).toHaveBeenCalledWith(Buffer.alloc(100))
    })

    it('Range 请求格式错误应返回 416', async () => {
      mockReq.headers.range = 'bytes=invalid'
      mockReq.range = jest.fn().mockReturnValue(-1)

      minioService.statObject.mockResolvedValue({ size: 1024, contentType: 'model/gltf-binary', etag: 'etag1', lastModified: new Date('2026-01-01') })

      await controller.proxy('three-mode', mockReq as Request, mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(416)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes */1024')
      expect(mockRes.end).toHaveBeenCalled()
    })
  })
})
