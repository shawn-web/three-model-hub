import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { GeoMapsService } from '../geo-maps.service'
import { GeoMap } from '../entities/geo-map.entity'
import { GeoMapModel } from '../entities/geo-map-model.entity'
import { Model } from '../../models/entities/model.entity'

/**
 * GeoMapsService 单元测试
 *
 * 覆盖：
 *   - findAll: 分页 + 搜索（mock createQueryBuilder）
 *   - findOne: 存在/不存在 404
 *   - create / update / remove
 *   - addModel / updateModel / removeModel
 *   - saveGeoConfig: 事务批量更新 + config 写入
 *   - getMapData: JOIN models 返回完整数据
 *   - getIframeConfig: allowedOrigins 合并环境变量
 */
describe('GeoMapsService', () => {
  let service: GeoMapsService
  let mockGeoMapRepo: any
  let mockGeoMapModelRepo: any
  let mockModelRepo: any
  let mockDataSource: jest.Mocked<DataSource>

  beforeEach(async () => {
    mockGeoMapRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'g1', geo_map_models: [], ...dto })),
      save: jest.fn(async (e) => e),
      remove: jest.fn(async (_e) => undefined),
    }
    mockGeoMapModelRepo = {
      create: jest.fn((dto) => ({ id: 'gm1', ...dto })),
      save: jest.fn(async (e) => e),
      findOne: jest.fn(),
      remove: jest.fn(async (_e) => undefined),
      createQueryBuilder: jest.fn(),
    }
    mockModelRepo = {
      findBy: jest.fn(),
      findOne: jest.fn(),
    }
    mockDataSource = {
      transaction: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoMapsService,
        { provide: getRepositoryToken(GeoMap), useValue: mockGeoMapRepo },
        { provide: getRepositoryToken(GeoMapModel), useValue: mockGeoMapModelRepo },
        { provide: getRepositoryToken(Model), useValue: mockModelRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile()

    service = module.get<GeoMapsService>(GeoMapsService)
  })

  describe('findAll', () => {
    it('应支持分页和搜索', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'g1' }], 1]),
      }
      mockGeoMapRepo.createQueryBuilder.mockReturnValue(mockQb)

      const result = await service.findAll({ page: 1, limit: 10, search: 'test' })

      expect(result).toEqual({ items: [{ id: 'g1' }], total: 1, page: 1, limit: 10 })
      expect(mockQb.where).toHaveBeenCalledWith('geo_map.name LIKE :search', { search: '%test%' })
      expect(mockQb.skip).toHaveBeenCalledWith(0)
      expect(mockQb.take).toHaveBeenCalledWith(10)
    })

    it('limit 上限 100', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }
      mockGeoMapRepo.createQueryBuilder.mockReturnValue(mockQb)

      const result = await service.findAll({ limit: 200 })

      expect(result.limit).toBe(100)
    })
  })

  describe('findOne', () => {
    it('存在时返回（含 geo_map_models 关联）', async () => {
      const geoMap = { id: 'g1', name: '地图1', geo_map_models: [] }
      mockGeoMapRepo.findOne.mockResolvedValue(geoMap)

      const result = await service.findOne('g1')

      expect(result).toEqual(geoMap)
      expect(mockGeoMapRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'g1' },
        relations: ['geo_map_models'],
      })
    })

    it('不存在时抛 404', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue(null)
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('应创建地图', async () => {
      const result = await service.create({ name: '新地图' })

      expect(result.name).toBe('新地图')
      expect(mockGeoMapRepo.create).toHaveBeenCalledWith({
        name: '新地图',
        description: undefined,
        config: {},
      })
    })

    it('有 config 时应保存', async () => {
      const result = await service.create({ name: 'm', config: { geo: { enabled: true } } })

      expect(result.config).toEqual({ geo: { enabled: true } })
    })
  })

  describe('update', () => {
    it('不存在时抛 404', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue(null)
      await expect(service.update('nope', { name: 'x' })).rejects.toThrow(NotFoundException)
    })

    it('正常更新', async () => {
      const existing = { id: 'g1', name: '旧' }
      mockGeoMapRepo.findOne.mockResolvedValue(existing)

      await service.update('g1', { name: '新' })

      expect(existing.name).toBe('新')
      expect(mockGeoMapRepo.save).toHaveBeenCalledWith(existing)
    })

    it('config.geo.allowedOrigins 为非字符串数组时抛错', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1' })

      await expect(service.update('g1', {
        config: { geo: { allowedOrigins: [123] } },
      } as any)).rejects.toThrow()
    })
  })

  describe('remove', () => {
    it('存在时删除', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1' })

      await service.remove('g1')

      expect(mockGeoMapRepo.remove).toHaveBeenCalled()
    })
  })

  describe('addModel', () => {
    it('应添加模型到地图', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1', geo_map_models: [] })
      mockModelRepo.findOne.mockResolvedValue({ id: 'm1' })

      await service.addModel('g1', { model_id: 'm1' })

      expect(mockGeoMapModelRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          geo_map_id: 'g1',
          model_id: 'm1',
          model_version_id: null,
          visible: true,
          sort_order: 0,
          geo_position: null,
          display_name: null,
        }),
      )
      expect(mockGeoMapModelRepo.save).toHaveBeenCalled()
    })
  })

  describe('updateModel', () => {
    it('不存在时抛 404', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1' })
      mockGeoMapModelRepo.findOne.mockResolvedValue(null)

      await expect(service.updateModel('g1', 'gm1', { display_name: 'x' }))
        .rejects.toThrow(NotFoundException)
    })

    it('正常更新 geo_position', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1' })
      const gm = { id: 'gm1', geo_position: null }
      mockGeoMapModelRepo.findOne.mockResolvedValue(gm)

      await service.updateModel('g1', 'gm1', {
        geo_position: { longitude: 116, latitude: 39, altitude: 0 },
      })

      expect(gm.geo_position).toEqual({ longitude: 116, latitude: 39, altitude: 0 })
      expect(mockGeoMapModelRepo.save).toHaveBeenCalledWith(gm)
    })
  })

  describe('removeModel', () => {
    it('不存在时抛 404', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1' })
      mockGeoMapModelRepo.findOne.mockResolvedValue(null)

      await expect(service.removeModel('g1', 'gm1')).rejects.toThrow(NotFoundException)
    })

    it('存在时删除', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1' })
      const gm = { id: 'gm1' }
      mockGeoMapModelRepo.findOne.mockResolvedValue(gm)

      await service.removeModel('g1', 'gm1')

      expect(mockGeoMapModelRepo.remove).toHaveBeenCalledWith(gm)
    })
  })

  describe('saveGeoConfig', () => {
    it('应在事务中批量更新模型并写入 config', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1' })

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'gm1', display_name: '旧', geo_position: null, visible: true },
        ]),
      }
      const mockManager = {
        getRepository: jest.fn((entity: any) => {
          if (entity.name === 'GeoMap') {
            return {
              findOne: jest.fn().mockResolvedValue({ id: 'g1', config: {} }),
              save: jest.fn().mockResolvedValue({}),
            }
          }
          // GeoMapModel repository
          return { createQueryBuilder: jest.fn().mockReturnValue(mockQb) }
        }),
        save: jest.fn().mockResolvedValue({}),
      }

      mockDataSource.transaction.mockImplementation(async (cb: any) => {
        await cb(mockManager as any)
      })

      await service.saveGeoConfig('g1', {
        models: [{ id: 'gm1', geo_position: { longitude: 116, latitude: 39, altitude: 0 } }],
        geoConfig: { imageryProvider: 'tianditu' },
      })

      expect(mockDataSource.transaction).toHaveBeenCalled()
      expect(mockManager.save).toHaveBeenCalled()
    })
  })

  describe('getMapData', () => {
    it('不存在时抛 404', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue(null)
      await expect(service.getMapData('nope')).rejects.toThrow(NotFoundException)
    })

    it('应 JOIN models 返回完整数据', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({
        id: 'g1', name: '地图1', description: 'desc',
        thumbnail_url: 'thumb.png', config: {},
        created_at: new Date(), updated_at: new Date(),
        geo_map_models: [
          { id: 'gm1', model_id: 'm1', display_name: '模型1', geo_position: null, visible: true, sort_order: 0 },
        ],
      })
      mockModelRepo.findBy.mockResolvedValue([
        { id: 'm1', file_url: 'http://f.glb', thumbnail_url: 't.png', name: '模型A' },
      ])

      const result = await service.getMapData('g1')

      expect(result.id).toBe('g1')
      expect(result.models).toHaveLength(1)
      expect(result.models[0]).toEqual(
        expect.objectContaining({
          id: 'gm1',
          model_id: 'm1',
          file_url: 'http://f.glb',
          thumbnail_url: 't.png',
          model_name: '模型A',
        }),
      )
    })

    it('无模型时 models 为空数组', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({
        id: 'g1', name: '空地图', description: null,
        thumbnail_url: null, config: null,
        created_at: null, updated_at: null,
        geo_map_models: [],
      })

      const result = await service.getMapData('g1')

      expect(result.models).toEqual([])
      expect(mockModelRepo.findBy).not.toHaveBeenCalled()
    })
  })

  describe('getIframeConfig', () => {
    it('allowedOrigins 为空时默认 self', async () => {
      mockGeoMapRepo.findOne.mockResolvedValue({ id: 'g1', name: 'm', config: {} })

      const result = await service.getIframeConfig('g1')

      expect(result.mapId).toBe('g1')
      expect(result.allowedOrigins).toBeNull()
      expect(result.frameAncestors).toEqual(['self'])
    })

    it('allowedOrigins 有值时合并环境变量', async () => {
      process.env.IFRAME_FRAME_ANCESTORS = 'https://a.com,https://b.com'
      mockGeoMapRepo.findOne.mockResolvedValue({
        id: 'g1', name: 'm',
        config: { geo: { allowedOrigins: ['https://c.com'] } },
      })

      const result = await service.getIframeConfig('g1')

      expect(result.allowedOrigins).toEqual(['https://c.com'])
      expect(result.frameAncestors).toContain('https://c.com')
      expect(result.frameAncestors).toContain('https://a.com')

      delete process.env.IFRAME_FRAME_ANCESTORS
    })
  })
})