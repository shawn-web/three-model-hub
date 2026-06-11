import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { UploadService, CHUNK_SIZE } from '../upload.service'
import { UploadSession } from '../entities/upload-session.entity'
import { MinioService } from '../../minio/minio.service'
import { StorageService } from '../../storage/storage.service'
import { InitMultipartDto } from '../dto/init-multipart.dto'
import { CompleteMultipartDto } from '../dto/complete-multipart.dto'

/**
 * UploadService 单元测试
 *
 * 覆盖：
 *   - initMultipart: 写 session、返回 partSize/totalParts
 *   - uploadPart: 调 minio、累加 etag、状态校验
 *   - completeMultipart: 调 minio.complete、parts 与 session 一致校验、标记 status=completed
 *   - abort: 幂等、调 minio.abort、标记 status=aborted
 *   - status: 直接读 session.uploaded_parts（不再依赖 minio.listParts）
 *   - uploadSimple: 调 minio.putObject
 */
describe('UploadService', () => {
  let service: UploadService
  let mockSessionRepo: any
  let mockMinio: jest.Mocked<MinioService>
  let mockStorage: jest.Mocked<StorageService>

  beforeEach(async () => {
    mockSessionRepo = {
      create: jest.fn((dto) => ({ id: 'session-1', ...dto })),
      save: jest.fn(async (s) => s),
      findOne: jest.fn(),
      // 默认返回受影响的行数 1（让成功路径走通）；具体测试可覆盖
      query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    }

    mockMinio = {
      initMultipart: jest.fn(),
      uploadPart: jest.fn(),
      completeMultipart: jest.fn(),
      abortMultipart: jest.fn(),
      listParts: jest.fn(),
      putObject: jest.fn(),
      getPublicUrl: jest.fn(),
      getBucket: jest.fn().mockReturnValue('three-mode'),
    } as any

    mockStorage = {
      generateObjectKey: jest.fn().mockReturnValue('labs/models/2026/06/uuid.glb'),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: getRepositoryToken(UploadSession), useValue: mockSessionRepo },
        { provide: MinioService, useValue: mockMinio },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile()

    service = module.get<UploadService>(UploadService)
  })

  describe('initMultipart', () => {
    it('100MB 文件应返回 partSize=8MB, totalParts=13', async () => {
      mockMinio.initMultipart.mockResolvedValue('up-1')

      const dto: InitMultipartDto = {
        fileName: 'big.glb',
        fileSize: 100 * 1024 * 1024,
        mimeType: 'model/gltf-binary',
        bizType: 'model',
      }

      const result = await service.initMultipart(dto)

      expect(result).toEqual({
        uploadId: 'up-1',
        objectKey: 'labs/models/2026/06/uuid.glb',
        partSize: CHUNK_SIZE,
        totalParts: 13, // 100MB / 8MB = 12.5 → ceil 13
      })
      expect(mockSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          upload_id: 'up-1',
          status: 'pending',
          uploaded_parts: {},
        }),
      )
      expect(mockSessionRepo.save).toHaveBeenCalled()
    })
  })

  describe('uploadPart', () => {
    it('session 不存在时抛 NotFoundException', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null)

      await expect(
        service.uploadPart('up-1', 1, Buffer.from('p')),
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('session.status=completed 时抛 BadRequestException', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'completed',
        object_key: 'labs/x.glb',
      })

      await expect(
        service.uploadPart('up-1', 1, Buffer.from('p')),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('成功时应通过原子 UPDATE 写入 etag 到 session.uploaded_parts', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'pending',
        object_key: 'labs/x.glb',
        uploaded_parts: {},
      })
      mockMinio.uploadPart.mockResolvedValue('etag-1')

      const result = await service.uploadPart('up-1', 1, Buffer.from('p'))

      expect(result).toEqual({ etag: 'etag-1', partNumber: 1 })
      // 验证走的是原子 UPDATE 而不是 read-modify-write save
      expect(mockSessionRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('JSON_SET'),
        expect.arrayContaining(['$.1', 'etag-1', 'up-1']),
      )
      expect(mockSessionRepo.save).not.toHaveBeenCalled()
    })

    it('UPDATE 影响 0 行（session 已不在 pending）时抛 BadRequestException', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'pending',
        object_key: 'labs/x.glb',
        uploaded_parts: {},
      })
      mockMinio.uploadPart.mockResolvedValue('etag-1')
      mockSessionRepo.query.mockResolvedValueOnce([{ affectedRows: 0 }])

      await expect(
        service.uploadPart('up-1', 1, Buffer.from('p')),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('completeMultipart', () => {
    it('session 不存在时抛 NotFoundException', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null)

      const dto: CompleteMultipartDto = {
        uploadId: 'up-1',
        parts: [{ partNumber: 1, etag: 'e1' }],
      }

      await expect(service.completeMultipart(dto)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('已完成的 session 幂等返回结果', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'completed',
        object_key: 'labs/x.glb',
        file_size: 1000,
      })
      mockMinio.getPublicUrl.mockReturnValue('http://localhost:9000/three-mode/labs/x.glb')

      const result = await service.completeMultipart({
        uploadId: 'up-1',
        parts: [{ partNumber: 1, etag: 'e1' }],
      })

      expect(result.url).toContain('three-mode')
      expect(mockMinio.completeMultipart).not.toHaveBeenCalled()
    })

    it('成功时调 minio.completeMultipart + 标记 status=completed', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'pending',
        object_key: 'labs/x.glb',
        file_size: 16 * 1024 * 1024,
        uploaded_parts: { '1': 'e1', '2': 'e2' },
      })
      mockMinio.completeMultipart.mockResolvedValue({ etag: 'final' })
      mockMinio.getPublicUrl.mockReturnValue('http://x')

      const result = await service.completeMultipart({
        uploadId: 'up-1',
        parts: [
          { partNumber: 1, etag: 'e1' },
          { partNumber: 2, etag: 'e2' },
        ],
      })

      expect(result.fileSize).toBe(16 * 1024 * 1024)
      expect(mockSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      )
    })

    it('parts 数量与 session 不一致时抛 BadRequestException', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'pending',
        object_key: 'labs/x.glb',
        file_size: 16 * 1024 * 1024,
        uploaded_parts: { '1': 'e1', '2': 'e2' },
      })

      await expect(
        service.completeMultipart({
          uploadId: 'up-1',
          parts: [{ partNumber: 1, etag: 'e1' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(mockMinio.completeMultipart).not.toHaveBeenCalled()
    })

    it('parts 的 etag 与 session 不一致时抛 BadRequestException', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'pending',
        object_key: 'labs/x.glb',
        file_size: 16 * 1024 * 1024,
        uploaded_parts: { '1': 'e1', '2': 'e2' },
      })

      await expect(
        service.completeMultipart({
          uploadId: 'up-1',
          parts: [
            { partNumber: 1, etag: 'e1' },
            { partNumber: 2, etag: 'tampered' },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(mockMinio.completeMultipart).not.toHaveBeenCalled()
    })

    it('aborted session 抛 BadRequestException', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'aborted',
        object_key: 'labs/x.glb',
        file_size: 1000,
      })

      await expect(
        service.completeMultipart({
          uploadId: 'up-1',
          parts: [{ partNumber: 1, etag: 'e1' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('abort', () => {
    it('session 不存在时直接返回 success（幂等）', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null)

      const result = await service.abort('up-1')

      expect(result).toEqual({ success: true })
      expect(mockMinio.abortMultipart).not.toHaveBeenCalled()
    })

    it('已 completed 的 session 直接返回 success（幂等）', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'completed',
        object_key: 'labs/x.glb',
      })

      const result = await service.abort('up-1')

      expect(result).toEqual({ success: true })
      expect(mockMinio.abortMultipart).not.toHaveBeenCalled()
    })

    it('pending session 调 minio.abort + 标记 status=aborted', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'pending',
        object_key: 'labs/x.glb',
      })
      mockMinio.abortMultipart.mockResolvedValue(undefined)

      await service.abort('up-1')

      expect(mockMinio.abortMultipart).toHaveBeenCalledWith('up-1', 'labs/x.glb')
      expect(mockSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'aborted' }),
      )
    })
  })

  describe('status', () => {
    it('session 不存在时抛 NotFoundException', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null)

      await expect(service.status('up-1')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('pending session 直接读 session.uploaded_parts 拼数组', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'pending',
        object_key: 'labs/x.glb',
        file_size: 16 * 1024 * 1024,
        uploaded_parts: { '1': 'e1', '2': 'e2' },
      })

      const result = await service.status('up-1')

      expect(result.uploadedParts).toEqual([1, 2])
      expect(result.objectKey).toBe('labs/x.glb')
      expect(result.fileSize).toBe(16 * 1024 * 1024)
      // 关键：不应依赖 minio.listParts
      expect(mockMinio.listParts).not.toHaveBeenCalled()
    })

    it('completed/aborted session 应返回空数组（前端应重新 init）', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        upload_id: 'up-1',
        status: 'aborted',
        object_key: 'labs/x.glb',
        file_size: 1000,
        uploaded_parts: { '1': 'e1' },
      })

      const result = await service.status('up-1')
      expect(result.uploadedParts).toEqual([])
    })
  })

  describe('uploadSimple', () => {
    it('应调 minio.putObject 并返回 url/fileKey/fileSize', async () => {
      mockMinio.putObject.mockResolvedValue(undefined)
      mockMinio.getPublicUrl.mockReturnValue('http://localhost:9000/three-mode/labs/x.png')

      const file = {
        originalname: 'a.png',
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
        size: 100,
      } as any

      const result = await service.uploadSimple(file, 'resource-image')

      expect(result.fileSize).toBe(100)
      expect(result.url).toContain('three-mode')
      expect(mockMinio.putObject).toHaveBeenCalledWith(
        'labs/models/2026/06/uuid.glb', // mockStorage 返回的
        file.buffer,
        'image/png',
      )
    })
  })
})
