import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ResourcesService } from '../resources.service'
import { Resource, ResourceType } from '../entities/resource.entity'
import { ResourceGroup } from '../entities/resource-group.entity'
import { StorageService } from '../../storage/storage.service'

/**
 * ResourcesService.uploadAndCreate 改造测试
 *
 * 覆盖：接收 multipart 文件后调 storageService.uploadFile（内部走 MinIO）
 */
describe('ResourcesService', () => {
  let service: ResourcesService
  let mockResourceRepo: any
  let mockGroupRepo: any
  let mockStorage: jest.Mocked<StorageService>

  beforeEach(async () => {
    mockResourceRepo = {
      create: jest.fn((dto) => ({ id: 'r1', ...dto })),
      save: jest.fn(async (s) => s),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    }
    mockGroupRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (s) => s),
      findOne: jest.fn(),
      remove: jest.fn(),
    }
    mockStorage = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        { provide: getRepositoryToken(Resource), useValue: mockResourceRepo },
        { provide: getRepositoryToken(ResourceGroup), useValue: mockGroupRepo },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile()

    service = module.get<ResourcesService>(ResourcesService)
  })

  describe('uploadAndCreate', () => {
    it('图片类型应传 labs/images 给 storageService.uploadFile', async () => {
      mockStorage.uploadFile.mockResolvedValue({
        url: 'http://localhost:9000/three-model-hub/labs/images/uuid.png',
        fileKey: 'labs/images/2026/06/uuid.png',
      })

      const file = {
        originalname: 'a.png',
        buffer: Buffer.from('img'),
        mimetype: 'image/png',
        size: 100,
      } as any

      const result = await service.uploadAndCreate(file, {
        name: 'a',
        type: ResourceType.IMAGE,
        width: 100,
        height: 200,
      })

      expect(mockStorage.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'a.png',
        undefined,
        undefined,
        'labs/images',
      )
      expect(result.file_key).toBe('labs/images/2026/06/uuid.png')
      expect(result.url).toContain('three-model-hub')
    })

    it('视频类型应传 labs/videos', async () => {
      mockStorage.uploadFile.mockResolvedValue({
        url: 'http://x',
        fileKey: 'labs/videos/uuid.mp4',
      })

      const file = { originalname: 'a.mp4', buffer: Buffer.from('v'), mimetype: 'video/mp4', size: 1000 } as any

      await service.uploadAndCreate(file, { name: 'a', type: ResourceType.VIDEO })

      expect(mockStorage.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'a.mp4',
        undefined,
        undefined,
        'labs/videos',
      )
    })
  })

  describe('removeResource', () => {
    it('有 fileKey 时应先调 storageService.deleteFile', async () => {
      mockResourceRepo.findOne.mockResolvedValue({
        id: 'r1',
        file_key: 'labs/images/x.png',
      })
      mockStorage.deleteFile.mockResolvedValue(undefined)

      await service.removeResource('r1')

      expect(mockStorage.deleteFile).toHaveBeenCalledWith('labs/images/x.png')
      expect(mockResourceRepo.remove).toHaveBeenCalled()
    })
  })
})
