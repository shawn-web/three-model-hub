import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException } from '@nestjs/common'
import { ResourcesService } from '../resources.service'
import { Resource, ResourceType } from '../entities/resource.entity'
import { ResourceGroup } from '../entities/resource-group.entity'
import { StorageService } from '../../storage/storage.service'
import type { UploadResourceDto } from '../dto/resource.dto'

/**
 * ResourcesService 单元测试
 *
 * 覆盖：
 *   - createFromFileRef：校验 fileKey 真实性后落库（替代旧 uploadAndCreate）
 *   - removeResource：有 fileKey 时先调 storageService.deleteFile
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
      verifyObject: jest.fn(),
      generateObjectKey: jest.fn(),
      getPublicUrl: jest.fn(),
      calculateHash: jest.fn(),
      detectFormat: jest.fn(),
    } as unknown as jest.Mocked<StorageService>

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

  describe('createFromFileRef', () => {
    const baseDto: UploadResourceDto = {
      name: 'test.png',
      type: ResourceType.IMAGE,
      url: 'http://localhost:9000/bucket/test.png',
      file_key: 'labs/images/test.png',
      file_size: 1024,
    }

    it('fileKey 不存在时抛 BadRequestException', async () => {
      mockStorage.verifyObject.mockResolvedValue({ exists: false })
      await expect(service.createFromFileRef(baseDto)).rejects.toBeInstanceOf(BadRequestException)
      expect(mockResourceRepo.create).not.toHaveBeenCalled()
    })

    it('fileKey 存在时应落库并返回 Resource', async () => {
      mockStorage.verifyObject.mockResolvedValue({ exists: true, size: 1024 })
      mockResourceRepo.save.mockResolvedValue({ id: 'r1', ...baseDto })

      const result = await service.createFromFileRef(baseDto)
      expect(mockStorage.verifyObject).toHaveBeenCalledWith(baseDto.file_key)
      expect(mockResourceRepo.save).toHaveBeenCalled()
      expect(result).toMatchObject({ name: baseDto.name, type: baseDto.type })
    })
  })

  describe('removeResource', () => {
    it('有 fileKey 时应先调 storageService.deleteFile', async () => {
      mockResourceRepo.findOne.mockResolvedValue({
        id: 'r1',
        file_key: 'labs/images/test.png',
      })
      mockStorage.deleteFile.mockResolvedValue(undefined)
      mockResourceRepo.remove.mockResolvedValue(undefined)

      await service.removeResource('r1')
      expect(mockStorage.deleteFile).toHaveBeenCalledWith('labs/images/test.png')
      expect(mockResourceRepo.remove).toHaveBeenCalled()
    })

    it('无 fileKey 时跳过 deleteFile 直接删除记录', async () => {
      mockResourceRepo.findOne.mockResolvedValue({ id: 'r1', file_key: null })
      mockResourceRepo.remove.mockResolvedValue(undefined)

      await service.removeResource('r1')
      expect(mockStorage.deleteFile).not.toHaveBeenCalled()
      expect(mockResourceRepo.remove).toHaveBeenCalled()
    })
  })
})