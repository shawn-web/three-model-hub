import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ModelsService } from '../models.service'
import { Model } from '../entities/model.entity'
import { ModelVersion } from '../entities/model-version.entity'
import { SceneModel } from '../../scenes/entities/scene-model.entity'
import { StorageService } from '../../storage/storage.service'
jest.mock('@gltf-transform/core', () => ({ NodeIO: class { constructor() {} } }))
jest.mock('@gltf-transform/extensions', () => ({ EXTMeshoptCompression: class {}, EXTTextureWebP: class {} }))
jest.mock('@gltf-transform/functions', () => ({ dedup: jest.fn(), weld: jest.fn(), prune: jest.fn(), meshopt: jest.fn() }))
jest.mock('meshoptimizer', () => ({ MeshoptEncoder: {}, MeshoptDecoder: {} }))
jest.mock('../model-compression.service');
import { ModelCompressionService } from '../model-compression.service'

/**
 * ModelsService 单元测试
 *
 * 覆盖：
 *   - findAll: 分页 + 搜索 + 标签筛选
 *   - findOne: 存在/不存在 404
 *   - createFromUrl: file_key 校验 + 文件大小校验 + 创建 model 和 version
 *   - update / remove（含场景引用检查）
 *   - createVersionFromUrl: 版本号自增 + 更新模型引用
 *   - getVersions / copy / compareVersions / incrementDownloadCount / getFileRedirectUrl
 */
describe('ModelsService', () => {
  let service: ModelsService
  let mockModelRepo: any
  let mockVersionRepo: any
  let mockSceneModelRepo: any
  let mockStorage: jest.Mocked<StorageService>
  let mockCompression: jest.Mocked<ModelCompressionService>

  let mockDataSource: any
  let mockManager: any

  beforeEach(async () => {
    mockModelRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'm1', download_count: 0, version_count: 0, ...dto })),
      save: jest.fn(async (e) => e),
      remove: jest.fn(async (_e) => undefined),
      increment: jest.fn(async () => undefined),
    }
    mockVersionRepo = {
      create: jest.fn((dto) => ({ id: 'v1', ...dto })),
      save: jest.fn(async (e) => e),
      find: jest.fn(),
      findOne: jest.fn(),
    }
    mockSceneModelRepo = {
      createQueryBuilder: jest.fn(),
    }
    mockStorage = {
      verifyObject: jest.fn(),
      detectFormat: jest.fn().mockReturnValue('glb'),
      deleteFile: jest.fn(),
      getPublicUrl: jest.fn().mockReturnValue('http://minio/file.glb'),
    } as any
    mockCompression = {
      startCompression: jest.fn().mockResolvedValue({ taskId: 'task-1' }),
    } as any
    // mock DataSource.transaction：模拟事务内 manager 的 create/save/findOne 行为
    mockManager = {
      create: jest.fn((cls, dto) => ({ id: 'm1', download_count: 0, version_count: 0, ...dto })),
      save: jest.fn(async (cls, e) => typeof cls === 'function' ? e : cls),
      findOne: jest.fn(),
    }
    mockDataSource = {
      transaction: jest.fn(async (cb) => cb(mockManager)),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelsService,
        { provide: getRepositoryToken(Model), useValue: mockModelRepo },
        { provide: getRepositoryToken(ModelVersion), useValue: mockVersionRepo },
        { provide: getRepositoryToken(SceneModel), useValue: mockSceneModelRepo },
        { provide: StorageService, useValue: mockStorage },
        { provide: ModelCompressionService, useValue: mockCompression },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile()

    service = module.get<ModelsService>(ModelsService)
  })

  describe('findAll', () => {
    it('应支持分页和搜索', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'm1' }], 1]),
      }
      mockModelRepo.createQueryBuilder.mockReturnValue(mockQb)

      const result = await service.findAll({ page: 1, limit: 10, search: 'test' })

      expect(result).toEqual({ items: [{ id: 'm1' }], total: 1, page: 1, limit: 10 })
    })

    it('应支持标签筛选', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }
      mockModelRepo.createQueryBuilder.mockReturnValue(mockQb)

      await service.findAll({ tag: '建筑' })

      expect(mockQb.andWhere).toHaveBeenCalled()
    })
  })

  describe('findOne', () => {
    it('存在时返回（含 versions 关联）', async () => {
      const model = { id: 'm1', name: '模型1', versions: [] }
      mockModelRepo.findOne.mockResolvedValue(model)

      const result = await service.findOne('m1')

      expect(result).toEqual(model)
      expect(mockModelRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'm1' },
        relations: ['versions'],
      })
    })

    it('不存在时抛 404', async () => {
      mockModelRepo.findOne.mockResolvedValue(null)
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('createFromUrl', () => {
    const dto = {
      name: '测试模型',
      file_name: 'model.glb',
      file_size: 1024,
      file_url: 'http://f.glb',
      file_key: 'models/uuid.glb',
    }

    it('file_key 不存在时抛 BadRequestException', async () => {
      mockStorage.verifyObject.mockResolvedValue({ exists: false })

      await expect(service.createFromUrl(dto)).rejects.toThrow(BadRequestException)
    })

    it('文件大小不一致时仍创建（仅 warn 日志）', async () => {
      mockStorage.verifyObject.mockResolvedValue({ exists: true, size: 2048 })

      // 源码中大小不一致只记 warn，不抛异常（防前端伪造但允许误差场景）
      const result = await service.createFromUrl(dto)

      expect(result.model).toBeDefined()
    })

    it('正常创建 model 和 version', async () => {
      mockStorage.verifyObject.mockResolvedValue({ exists: true, size: 1024 })

      const result = await service.createFromUrl(dto)

      expect(result.model.name).toBe('测试模型')
      expect(mockManager.save).toHaveBeenCalled()
      expect(result.compressionTaskId).toBeUndefined()
    })

    it('compress=true 时触发压缩', async () => {
      mockStorage.verifyObject.mockResolvedValue({ exists: true, size: 1024 })

      const result = await service.createFromUrl({ ...dto, compress: true })

      expect(result.compressionTaskId).toBe('task-1')
      expect(mockCompression.startCompression).toHaveBeenCalled()
    })

    it('name 为空时用 file_name 去扩展名', async () => {
      mockStorage.verifyObject.mockResolvedValue({ exists: true, size: 1024 })

      await service.createFromUrl({ ...dto, name: undefined })

      expect(mockManager.create).toHaveBeenCalledWith(
        Model,
        expect.objectContaining({ name: 'model' }),
      )
    })
  })

  describe('update', () => {
    it('不存在时抛 404', async () => {
      mockModelRepo.findOne.mockResolvedValue(null)
      await expect(service.update('nope', { name: 'x' })).rejects.toThrow(NotFoundException)
    })

    it('正常更新', async () => {
      mockModelRepo.findOne.mockResolvedValue({ id: 'm1', name: '旧' })

      const result = await service.update('m1', { name: '新' })

      expect(result.name).toBe('新')
      expect(mockModelRepo.save).toHaveBeenCalled()
    })
  })

  describe('remove', () => {
    it('被场景引用时抛 BadRequestException', async () => {
      mockModelRepo.findOne.mockResolvedValue({ id: 'm1', versions: [] })
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ sceneId: 's1', sceneName: '场景1' }]),
      }
      mockSceneModelRepo.createQueryBuilder.mockReturnValue(mockQb)

      await expect(service.remove('m1')).rejects.toThrow(BadRequestException)
    })

    it('正常删除（含远程文件清理）', async () => {
      const model = { id: 'm1', file_key: 'k1', versions: [{ file_key: 'k2' }] }
      mockModelRepo.findOne.mockResolvedValue(model)
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }
      mockSceneModelRepo.createQueryBuilder.mockReturnValue(mockQb)

      await service.remove('m1')

      expect(mockStorage.deleteFile).toHaveBeenCalledWith('k1')
      expect(mockStorage.deleteFile).toHaveBeenCalledWith('k2')
      expect(mockModelRepo.remove).toHaveBeenCalledWith(model)
    })
  })

  describe('createVersionFromUrl', () => {
    const dto = {
      file_name: 'v2.glb',
      file_size: 2048,
      file_url: 'http://v2.glb',
      file_key: 'models/v2.glb',
    }

    it('file_key 不存在时抛 400', async () => {
      mockModelRepo.findOne.mockResolvedValue({ id: 'm1', version_count: 1 })
      mockStorage.verifyObject.mockResolvedValue({ exists: false })

      await expect(service.createVersionFromUrl('m1', dto)).rejects.toThrow(BadRequestException)
    })

    it('正常创建版本（版本号自增）', async () => {
      mockStorage.verifyObject.mockResolvedValue({ exists: true, size: 2048 })
      // 事务内 manager.findOne 查 model
      mockManager.findOne.mockResolvedValue({ id: 'm1', version_count: 1 })

      const result = await service.createVersionFromUrl('m1', dto)

      expect(result.version.version_number).toBe(2)
      expect(mockManager.save).toHaveBeenCalled()
    })
  })

  describe('getVersions', () => {
    it('应返回版本列表（按 version_number DESC）', async () => {
      const versions = [{ id: 'v2', version_number: 2 }, { id: 'v1', version_number: 1 }]
      mockVersionRepo.find.mockResolvedValue(versions)

      const result = await service.getVersions('m1')

      expect(result).toEqual(versions)
      expect(mockVersionRepo.find).toHaveBeenCalledWith({
        where: { model_id: 'm1' },
        order: { version_number: 'DESC' },
      })
    })
  })

  describe('copy', () => {
    it('应复制模型和最新版本', async () => {
      mockModelRepo.findOne.mockResolvedValue({
        id: 'm1', name: '模型A', description: 'd', tags: ['t'],
        file_url: 'http://f.glb', file_name: 'a.glb', file_size: 100,
        file_format: 'glb', thumbnail_url: 'thumb.png', file_key: 'k1',
      })
      mockVersionRepo.findOne.mockResolvedValue({
        id: 'v1', file_url: 'http://f.glb', file_size: 100,
        file_hash: 'abc', file_key: 'k1',
      })
      // 事务内：mockManager.findOne 返回加锁的原模型行
      mockManager.findOne.mockResolvedValue({
        id: 'm1', name: '模型A', description: 'd', tags: ['t'],
        file_url: 'http://f.glb', file_name: 'a.glb', file_size: 100,
        file_format: 'glb', thumbnail_url: 'thumb.png', file_key: 'k1',
      })

      const result = await service.copy('m1')

      expect(result.name).toBe('模型A (副本)')
      expect(mockManager.save).toHaveBeenCalled()
    })
  })

  describe('compareVersions', () => {
    it('版本不存在时抛 404', async () => {
      mockVersionRepo.findOne.mockResolvedValue(null)

      await expect(service.compareVersions('m1', 'v1', 'v2')).rejects.toThrow(NotFoundException)
    })

    it('正常返回差异', async () => {
      const v1 = { id: 'v1', file_size: 100, version_number: 1, created_at: new Date(2024, 0, 1), metadata: null }
      const v2 = { id: 'v2', file_size: 200, version_number: 2, created_at: new Date(2024, 0, 2), metadata: null }
      mockVersionRepo.findOne
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2)

      const result = await service.compareVersions('m1', 'v1', 'v2')

      expect(result.version1).toEqual(v1)
      expect(result.version2).toEqual(v2)
      expect(result.diff.file_size_diff).toBe(100)
    })
  })

  describe('incrementDownloadCount', () => {
    it('应增加下载计数', async () => {
      await service.incrementDownloadCount('m1')

      expect(mockModelRepo.increment).toHaveBeenCalledWith({ id: 'm1' }, 'download_count', 1)
    })
  })

  describe('getFileRedirectUrl', () => {
    it('模型不存在时抛 404', async () => {
      mockModelRepo.findOne.mockResolvedValue(null)
      await expect(service.getFileRedirectUrl('nope')).rejects.toThrow(NotFoundException)
    })

    it('file_url 为空时抛 404', async () => {
      mockModelRepo.findOne.mockResolvedValue({ id: 'm1', file_url: null })
      await expect(service.getFileRedirectUrl('m1')).rejects.toThrow(NotFoundException)
    })

    it('file_key 为空（旧数据）时抛 404', async () => {
      mockModelRepo.findOne.mockResolvedValue({ id: 'm1', file_url: 'http://old', file_key: null })
      await expect(service.getFileRedirectUrl('m1')).rejects.toThrow(NotFoundException)
    })

    it('正常返回公开 URL', async () => {
      mockModelRepo.findOne.mockResolvedValue({ id: 'm1', file_url: 'http://f', file_key: 'k1' })

      const result = await service.getFileRedirectUrl('m1')

      expect(result).toBe('http://minio/file.glb')
      expect(mockStorage.getPublicUrl).toHaveBeenCalledWith('k1')
    })
  })
})