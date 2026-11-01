import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { ScenesService } from '../scenes.service'
import { Scene } from '../entities/scene.entity'
import { SceneModel } from '../entities/scene-model.entity'
import { SceneImage } from '../entities/scene-image.entity'
import { Model } from '../../models/entities/model.entity'
import { ModelVersion } from '../../models/entities/model-version.entity'

/**
 * ScenesService 单元测试
 *
 * 覆盖：
 *   - findAll: 分页 + 搜索
 *   - findOne: 存在/不存在 404
 *   - create / update / remove
 *   - addModel / updateModel / removeModel
 *   - saveGeoConfig: 事务保存
 *   - getSceneData: JOIN 返回完整数据
 *   - addImage / updateImage / removeImage / batchSaveImages
 */
describe('ScenesService', () => {
  let service: ScenesService
  let mockSceneRepo: any
  let mockSceneModelRepo: any
  let mockSceneImageRepo: any
  let mockModelRepo: any
  let mockVersionRepo: any
  let mockDataSource: jest.Mocked<DataSource>

  beforeEach(async () => {
    mockSceneRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 's1', ...dto })),
      save: jest.fn(async (e) => e),
      remove: jest.fn(async (_e) => undefined),
    }
    mockSceneModelRepo = {
      create: jest.fn((dto) => ({ id: 'sm1', ...dto })),
      save: jest.fn(async (e) => e),
      findOne: jest.fn(),
      remove: jest.fn(async (_e) => undefined),
      createQueryBuilder: jest.fn(),
    }
    mockSceneImageRepo = {
      create: jest.fn((dto) => ({ id: 'si1', ...dto })),
      save: jest.fn(async (e) => e),
      findOne: jest.fn(),
      remove: jest.fn(async (_e) => undefined),
    }
    mockModelRepo = {
      findBy: jest.fn(),
      findOne: jest.fn(),
    }
    mockVersionRepo = {
      findBy: jest.fn(),
    }
    mockDataSource = {
      transaction: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenesService,
        { provide: getRepositoryToken(Scene), useValue: mockSceneRepo },
        { provide: getRepositoryToken(SceneModel), useValue: mockSceneModelRepo },
        { provide: getRepositoryToken(SceneImage), useValue: mockSceneImageRepo },
        { provide: getRepositoryToken(Model), useValue: mockModelRepo },
        { provide: getRepositoryToken(ModelVersion), useValue: mockVersionRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile()

    service = module.get<ScenesService>(ScenesService)
  })

  describe('findAll', () => {
    it('应支持分页和搜索', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 's1' }], 1]),
      }
      mockSceneRepo.createQueryBuilder.mockReturnValue(mockQb)

      const result = await service.findAll({ page: 1, limit: 10, search: 'test' })

      expect(result).toEqual({ items: [{ id: 's1' }], total: 1, page: 1, limit: 10 })
      expect(mockQb.where).toHaveBeenCalledWith('scene.name LIKE :search', { search: '%test%' })
    })

    it('limit 上限 100', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }
      mockSceneRepo.createQueryBuilder.mockReturnValue(mockQb)

      const result = await service.findAll({ limit: 200 })
      expect(result.limit).toBe(100)
    })
  })

  describe('findOne', () => {
    it('存在时返回（含 scene_models 和 scene_images 关联）', async () => {
      const scene = { id: 's1', name: '场景1', scene_models: [], scene_images: [] }
      mockSceneRepo.findOne.mockResolvedValue(scene)

      const result = await service.findOne('s1')

      expect(result).toEqual(scene)
      expect(mockSceneRepo.findOne).toHaveBeenCalledWith({
        where: { id: 's1' },
        relations: ['scene_models', 'scene_images'],
      })
    })

    it('不存在时抛 404', async () => {
      mockSceneRepo.findOne.mockResolvedValue(null)
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('应创建场景', async () => {
      const result = await service.create({ name: '新场景' })

      expect(result.name).toBe('新场景')
      expect(mockSceneRepo.create).toHaveBeenCalledWith({
        name: '新场景',
        description: undefined,
        scene_config: { backgroundColor: '#1a1a2e', autoRotate: false },
      })
    })

    it('有 scene_config 时使用传入值', async () => {
      const result = await service.create({
        name: 's',
        scene_config: { backgroundColor: '#000' },
      })

      expect(result.scene_config).toEqual({ backgroundColor: '#000' })
    })
  })

  describe('update', () => {
    it('不存在时抛 404', async () => {
      mockSceneRepo.findOne.mockResolvedValue(null)
      await expect(service.update('nope', { name: 'x' })).rejects.toThrow(NotFoundException)
    })

    it('正常更新', async () => {
      const existing = { id: 's1', name: '旧' }
      mockSceneRepo.findOne.mockResolvedValue(existing)

      await service.update('s1', { name: '新' })

      expect(existing.name).toBe('新')
      expect(mockSceneRepo.save).toHaveBeenCalledWith(existing)
    })
  })

  describe('remove', () => {
    it('存在时删除', async () => {
      mockSceneRepo.findOne.mockResolvedValue({ id: 's1', scene_models: [], scene_images: [] })

      await service.remove('s1')

      expect(mockSceneRepo.remove).toHaveBeenCalled()
    })
  })

  describe('addModel', () => {
    it('场景不存在时抛 404', async () => {
      mockSceneRepo.findOne.mockResolvedValue(null)
      await expect(service.addModel('nope', { model_id: 'm1' })).rejects.toThrow(NotFoundException)
    })

    it('应添加模型到场景', async () => {
      mockSceneRepo.findOne.mockResolvedValue({ id: 's1', scene_models: [], scene_images: [] })
      mockModelRepo.findOne.mockResolvedValue({ id: 'm1' })

      await service.addModel('s1', { model_id: 'm1' })

      expect(mockSceneModelRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scene_id: 's1',
          model_id: 'm1',
          visible: true,
          sort_order: 0,
        }),
      )
      expect(mockSceneModelRepo.save).toHaveBeenCalled()
    })
  })

  describe('updateModel', () => {
    it('不存在时抛 404', async () => {
      mockSceneModelRepo.findOne.mockResolvedValue(null)
      await expect(service.updateModel('s1', 'sm1', { visible: false }))
        .rejects.toThrow(NotFoundException)
    })

    it('正常更新', async () => {
      const sm = { id: 'sm1', visible: true }
      mockSceneModelRepo.findOne.mockResolvedValue(sm)

      await service.updateModel('s1', 'sm1', { visible: false })

      expect(sm.visible).toBe(false)
      expect(mockSceneModelRepo.save).toHaveBeenCalledWith(sm)
    })
  })

  describe('removeModel', () => {
    it('不存在时抛 404', async () => {
      mockSceneModelRepo.findOne.mockResolvedValue(null)
      await expect(service.removeModel('s1', 'sm1')).rejects.toThrow(NotFoundException)
    })

    it('存在时删除', async () => {
      const sm = { id: 'sm1' }
      mockSceneModelRepo.findOne.mockResolvedValue(sm)

      await service.removeModel('s1', 'sm1')

      expect(mockSceneModelRepo.remove).toHaveBeenCalledWith(sm)
    })
  })

  describe('saveGeoConfig', () => {
    it('应在事务中批量更新模型并写入 config', async () => {
      mockSceneRepo.findOne.mockResolvedValue({ id: 's1' })

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'sm1', geo_position: null },
        ]),
      }
      mockSceneModelRepo.createQueryBuilder.mockReturnValue(mockQb)

      const mockManager = {
        getRepository: jest.fn((entity: any) => {
          if (entity.name === 'Scene') {
            return {
              findOne: jest.fn().mockResolvedValue({ id: 's1', config: {} }),
              save: jest.fn().mockResolvedValue({}),
            }
          }
          return { createQueryBuilder: jest.fn().mockReturnValue(mockQb) }
        }),
        save: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue(undefined),
      }

      mockDataSource.transaction.mockImplementation(async (cb: any) => {
        await cb(mockManager)
      })

      await service.saveGeoConfig('s1', {
        models: [{ id: 'sm1', geo_position: { longitude: 116, latitude: 39, altitude: 0 } }],
        geoConfig: { imageryProvider: 'tianditu' },
      })

      expect(mockDataSource.transaction).toHaveBeenCalled()
    })
  })

  describe('getSceneData', () => {
    it('不存在时抛 404', async () => {
      mockSceneRepo.findOne.mockResolvedValue(null)
      await expect(service.getSceneData('nope')).rejects.toThrow(NotFoundException)
    })

    it('应返回完整数据（含模型文件信息）', async () => {
      mockSceneRepo.findOne.mockResolvedValue({
        id: 's1', name: '场景1', description: 'd',
        scene_config: {}, thumbnail_url: null,
        created_at: new Date(), updated_at: new Date(),
        scene_models: [
          { id: 'sm1', model_id: 'm1', model_version_id: null, transform: null,
            material_overrides: null, visible: true, display_name: '模型1',
            sort_order: 0, geo_position: null },
        ],
        scene_images: [],
      })
      mockModelRepo.findBy.mockResolvedValue([
        { id: 'm1', file_url: 'http://f.glb', thumbnail_url: 't.png', name: '模型A' },
      ])
      mockVersionRepo.findBy.mockResolvedValue([])

      const result = await service.getSceneData('s1')

      expect(result.id).toBe('s1')
      expect(result.models).toHaveLength(1)
      expect(result.models[0].file_url).toBe('http://f.glb')
    })

    it('无模型时 models 为空数组', async () => {
      mockSceneRepo.findOne.mockResolvedValue({
        id: 's1', name: '空', description: null,
        scene_config: null, thumbnail_url: null,
        created_at: null, updated_at: null,
        scene_models: [], scene_images: [],
      })

      const result = await service.getSceneData('s1')

      expect(result.models).toEqual([])
    })
  })

  describe('addImage', () => {
    it('场景不存在时抛 404', async () => {
      mockSceneRepo.findOne.mockResolvedValue(null)
      await expect(service.addImage('nope', { name: 'img', width: 100, height: 100 } as any)).rejects.toThrow(NotFoundException)
    })

    it('应添加图片到场景', async () => {
      mockSceneRepo.findOne.mockResolvedValue({ id: 's1', scene_models: [], scene_images: [] })

      await service.addImage('s1', { name: '图片1', url: 'http://img.png', width: 100, height: 100 } as any)

      expect(mockSceneImageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scene_id: 's1',
          name: '图片1',
          url: 'http://img.png',
          visible: true,
          billboard: true,
        }),
      )
      expect(mockSceneImageRepo.save).toHaveBeenCalled()
    })
  })

  describe('updateImage', () => {
    it('不存在时抛 404', async () => {
      mockSceneImageRepo.findOne.mockResolvedValue(null)
      await expect(service.updateImage('s1', 'si1', { visible: false }))
        .rejects.toThrow(NotFoundException)
    })

    it('正常更新', async () => {
      const img = { id: 'si1', visible: true }
      mockSceneImageRepo.findOne.mockResolvedValue(img)

      await service.updateImage('s1', 'si1', { visible: false })

      expect(img.visible).toBe(false)
      expect(mockSceneImageRepo.save).toHaveBeenCalledWith(img)
    })
  })

  describe('removeImage', () => {
    it('不存在时抛 404', async () => {
      mockSceneImageRepo.findOne.mockResolvedValue(null)
      await expect(service.removeImage('s1', 'si1')).rejects.toThrow(NotFoundException)
    })

    it('存在时删除', async () => {
      const img = { id: 'si1' }
      mockSceneImageRepo.findOne.mockResolvedValue(img)

      await service.removeImage('s1', 'si1')

      expect(mockSceneImageRepo.remove).toHaveBeenCalledWith(img)
    })
  })

  describe('batchSaveImages', () => {
    it('场景不存在时抛 404', async () => {
      mockSceneRepo.findOne.mockResolvedValue(null)
      await expect(service.batchSaveImages('nope', [])).rejects.toThrow(NotFoundException)
    })

    it('应在事务中先删后建', async () => {
      mockSceneRepo.findOne.mockResolvedValue({ id: 's1' })

      const mockManager = {
        delete: jest.fn().mockResolvedValue(undefined),
        create: jest.fn((entity: any, dto: any) => ({ id: 'si-new', ...dto })),
        save: jest.fn().mockResolvedValue(undefined),
      }

      mockDataSource.transaction.mockImplementation(async (cb: any) => {
        await cb(mockManager)
      })

      await service.batchSaveImages('s1', [
        { name: 'img1', width: 100, height: 100 } as any,
        { name: 'img2', width: 100, height: 100 } as any,
      ])

      expect(mockManager.delete).toHaveBeenCalled()
      expect(mockManager.save).toHaveBeenCalled()
    })
  })
})