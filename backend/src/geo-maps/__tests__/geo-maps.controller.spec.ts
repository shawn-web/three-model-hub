import { Test, TestingModule } from '@nestjs/testing'
import { GeoMapsController } from '../geo-maps.controller'
import { GeoMapsService } from '../geo-maps.service'

/**
 * 地理地图管理控制器单元测试
 *
 * 覆盖路由：
 *   GET    /geo-maps                       列表
 *   GET    /geo-maps/:id                    详情
 *   GET    /geo-maps/:id/data               完整数据
 *   GET    /geo-maps/:id/iframe-config       iframe 嵌入配置
 *   POST   /geo-maps                        创建
 *   PUT    /geo-maps/:id                     更新
 *   DELETE /geo-maps/:id                     删除
 *   POST   /geo-maps/:id/models             添加模型
 *   PUT    /geo-maps/:id/geo                保存 Geo 配置
 *   PUT    /geo-maps/:id/models/batch       批量更新模型
 *   PUT    /geo-maps/:id/models/:mid        更新模型
 *   DELETE /geo-maps/:id/models/:mid        移除模型
 */
describe('GeoMapsController', () => {
  let controller: GeoMapsController
  let service: jest.Mocked<GeoMapsService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoMapsController],
      providers: [
        {
          provide: GeoMapsService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            getMapData: jest.fn(),
            getIframeConfig: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            addModel: jest.fn(),
            saveGeoConfig: jest.fn(),
            batchUpdateModels: jest.fn(),
            updateModel: jest.fn(),
            removeModel: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get(GeoMapsController)
    service = module.get(GeoMapsService)
  })

  describe('GET /geo-maps', () => {
    it('无参数应调用 findAll', async () => {
      const mockResult = { items: [], total: 0 }
      service.findAll.mockResolvedValue(mockResult as any)

      const result = await controller.findAll()

      expect(service.findAll).toHaveBeenCalledWith({ page: undefined, limit: undefined, search: undefined })
      expect(result).toBe(mockResult)
    })

    it('应将字符串参数转为数字', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 } as any)

      await controller.findAll('2', '5', '城市')

      expect(service.findAll).toHaveBeenCalledWith({ page: 2, limit: 5, search: '城市' })
    })
  })

  describe('GET /geo-maps/:id', () => {
    it('应返回地图详情', async () => {
      const mockMap = { id: 'g1', name: '地图' }
      service.findOne.mockResolvedValue(mockMap as any)

      const result = await controller.findOne('g1')

      expect(service.findOne).toHaveBeenCalledWith('g1')
      expect(result).toBe(mockMap)
    })
  })

  describe('GET /geo-maps/:id/data', () => {
    it('应返回地图完整数据', async () => {
      const mockData = { id: 'g1', name: '地图', models: [] }
      service.getMapData.mockResolvedValue(mockData as any)

      const result = await controller.getMapData('g1')

      expect(service.getMapData).toHaveBeenCalledWith('g1')
      expect(result).toBe(mockData)
    })
  })

  describe('GET /geo-maps/:id/iframe-config', () => {
    it('应返回 iframe 嵌入配置', async () => {
      const mockConfig = { frameAncestors: ['https://example.com'], allowedOrigins: ['https://example.com'] }
      service.getIframeConfig.mockResolvedValue(mockConfig as any)

      const result = await controller.getIframeConfig('g1')

      expect(service.getIframeConfig).toHaveBeenCalledWith('g1')
      expect(result).toBe(mockConfig)
    })
  })

  describe('POST /geo-maps', () => {
    it('应创建地图', async () => {
      const dto = { name: '新地图' }
      const mockMap = { id: 'g1', name: '新地图' }
      service.create.mockResolvedValue(mockMap as any)

      const result = await controller.create(dto as any)

      expect(service.create).toHaveBeenCalledWith(dto)
      expect(result).toBe(mockMap)
    })
  })

  describe('PUT /geo-maps/:id', () => {
    it('应更新地图', async () => {
      const dto = { name: '更新' }
      const mockMap = { id: 'g1', name: '更新' }
      service.update.mockResolvedValue(mockMap as any)

      const result = await controller.update('g1', dto as any)

      expect(service.update).toHaveBeenCalledWith('g1', dto)
      expect(result).toBe(mockMap)
    })
  })

  describe('DELETE /geo-maps/:id', () => {
    it('应删除地图并返回 success', async () => {
      service.remove.mockResolvedValue(undefined)

      const result = await controller.remove('g1')

      expect(service.remove).toHaveBeenCalledWith('g1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('POST /geo-maps/:id/models', () => {
    it('应添加模型到地图', async () => {
      const dto = { model_id: 'm1' }
      const mockResult = { id: 'gm1', model_id: 'm1' }
      service.addModel.mockResolvedValue(mockResult as any)

      const result = await controller.addModel('g1', dto as any)

      expect(service.addModel).toHaveBeenCalledWith('g1', dto)
      expect(result).toBe(mockResult)
    })
  })

  describe('PUT /geo-maps/:id/geo', () => {
    it('应原子保存 Geo 配置', async () => {
      const dto = { models: [], geoConfig: { imageryProvider: 'google' } }
      service.saveGeoConfig.mockResolvedValue({ success: true } as any)

      const result = await controller.saveGeoConfig('g1', dto as any)

      expect(service.saveGeoConfig).toHaveBeenCalledWith('g1', dto)
      expect(result).toEqual({ success: true })
    })
  })

  describe('PUT /geo-maps/:id/models/batch', () => {
    it('应批量更新地图模型', async () => {
      const dto = { models: [{ id: 'gm1', geo_position: {} }] }
      service.batchUpdateModels.mockResolvedValue(undefined)

      const result = await controller.batchUpdateModels('g1', dto as any)

      expect(service.batchUpdateModels).toHaveBeenCalledWith('g1', dto.models)
      expect(result).toEqual({ success: true })
    })
  })

  describe('PUT /geo-maps/:id/models/:mid', () => {
    it('应更新地图中的模型', async () => {
      const dto = { geo_position: { longitude: 121 } }
      const mockResult = { id: 'gm1', geo_position: { longitude: 121 } }
      service.updateModel.mockResolvedValue(mockResult as any)

      const result = await controller.updateModel('g1', 'gm1', dto as any)

      expect(service.updateModel).toHaveBeenCalledWith('g1', 'gm1', dto)
      expect(result).toBe(mockResult)
    })
  })

  describe('DELETE /geo-maps/:id/models/:mid', () => {
    it('应从地图移除模型', async () => {
      service.removeModel.mockResolvedValue(undefined)

      const result = await controller.removeModel('g1', 'gm1')

      expect(service.removeModel).toHaveBeenCalledWith('g1', 'gm1')
      expect(result).toEqual({ success: true })
    })
  })
})
