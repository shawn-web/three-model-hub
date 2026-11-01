import { Test, TestingModule } from '@nestjs/testing'
import { ScenesController } from '../scenes.controller'
import { ScenesService } from '../scenes.service'

/**
 * 场景管理控制器单元测试
 *
 * 覆盖路由：
 *   GET    /scenes                       列表
 *   GET    /scenes/:id                   详情
 *   GET    /scenes/:id/data              完整数据
 *   POST   /scenes                       创建
 *   PUT    /scenes/:id                   更新
 *   DELETE /scenes/:id                   删除
 *   PUT    /scenes/:id/geo               保存 Geo 配置
 *   POST   /scenes/:id/models           添加模型
 *   PUT    /scenes/:id/models/batch      批量更新模型
 *   PUT    /scenes/:id/models/:mid       更新模型
 *   DELETE /scenes/:id/models/:mid       移除模型
 *   POST   /scenes/:id/images           添加图片
 *   PUT    /scenes/:id/images/batch     批量保存图片
 *   PUT    /scenes/:id/images/:iid      更新图片
 *   DELETE /scenes/:id/images/:iid       移除图片
 */
describe('ScenesController', () => {
  let controller: ScenesController
  let service: jest.Mocked<ScenesService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScenesController],
      providers: [
        {
          provide: ScenesService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            getSceneData: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            saveGeoConfig: jest.fn(),
            addModel: jest.fn(),
            batchUpdateModels: jest.fn(),
            updateModel: jest.fn(),
            removeModel: jest.fn(),
            addImage: jest.fn(),
            batchSaveImages: jest.fn(),
            updateImage: jest.fn(),
            removeImage: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get(ScenesController)
    service = module.get(ScenesService)
  })

  describe('GET /scenes', () => {
    it('无参数应调用 findAll', async () => {
      const mockResult = { items: [], total: 0 }
      service.findAll.mockResolvedValue(mockResult as any)

      const result = await controller.findAll()

      expect(service.findAll).toHaveBeenCalledWith({ page: undefined, limit: undefined, search: undefined })
      expect(result).toBe(mockResult)
    })

    it('应将字符串参数转为数字', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 } as any)

      await controller.findAll('1', '10', 'keyword')

      expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 10, search: 'keyword' })
    })
  })

  describe('GET /scenes/:id', () => {
    it('应返回场景详情', async () => {
      const mockScene = { id: 's1', name: '场景' }
      service.findOne.mockResolvedValue(mockScene as any)

      const result = await controller.findOne('s1')

      expect(service.findOne).toHaveBeenCalledWith('s1')
      expect(result).toBe(mockScene)
    })
  })

  describe('GET /scenes/:id/data', () => {
    it('应返回场景完整数据', async () => {
      const mockData = { id: 's1', name: '场景', scene_models: [], scene_images: [] }
      service.getSceneData.mockResolvedValue(mockData as any)

      const result = await controller.getSceneData('s1')

      expect(service.getSceneData).toHaveBeenCalledWith('s1')
      expect(result).toBe(mockData)
    })
  })

  describe('POST /scenes', () => {
    it('应创建场景', async () => {
      const dto = { name: '新场景' }
      const mockScene = { id: 's1', name: '新场景' }
      service.create.mockResolvedValue(mockScene as any)

      const result = await controller.create(dto as any)

      expect(service.create).toHaveBeenCalledWith(dto)
      expect(result).toBe(mockScene)
    })
  })

  describe('PUT /scenes/:id', () => {
    it('应更新场景', async () => {
      const dto = { name: '更新' }
      const mockScene = { id: 's1', name: '更新' }
      service.update.mockResolvedValue(mockScene as any)

      const result = await controller.update('s1', dto as any)

      expect(service.update).toHaveBeenCalledWith('s1', dto)
      expect(result).toBe(mockScene)
    })
  })

  describe('DELETE /scenes/:id', () => {
    it('应删除场景并返回 success', async () => {
      service.remove.mockResolvedValue(undefined)

      const result = await controller.remove('s1')

      expect(service.remove).toHaveBeenCalledWith('s1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('PUT /scenes/:id/geo', () => {
    it('应原子保存 Geo 配置', async () => {
      const dto = { models: [], geoConfig: { foo: 'bar' } }
      service.saveGeoConfig.mockResolvedValue({ success: true } as any)

      const result = await controller.saveGeoConfig('s1', dto as any)

      expect(service.saveGeoConfig).toHaveBeenCalledWith('s1', dto)
      expect(result).toEqual({ success: true })
    })
  })

  describe('POST /scenes/:id/models', () => {
    it('应添加模型到场景', async () => {
      const dto = { model_id: 'm1', display_name: '模型1' }
      const mockSceneModel = { id: 'sm1', model_id: 'm1' }
      service.addModel.mockResolvedValue(mockSceneModel as any)

      const result = await controller.addModel('s1', dto as any)

      expect(service.addModel).toHaveBeenCalledWith('s1', dto)
      expect(result).toBe(mockSceneModel)
    })
  })

  describe('PUT /scenes/:id/models/batch', () => {
    it('应批量更新场景模型并返回 success', async () => {
      const dto = { models: [{ id: 'sm1', transform: {} }] }
      service.batchUpdateModels.mockResolvedValue(undefined)

      const result = await controller.batchUpdateModels('s1', dto as any)

      expect(service.batchUpdateModels).toHaveBeenCalledWith('s1', dto.models)
      expect(result).toEqual({ success: true })
    })
  })

  describe('PUT /scenes/:id/models/:mid', () => {
    it('应更新场景中的模型', async () => {
      const dto = { transform: { x: 1 } }
      const mockResult = { id: 'sm1', transform: { x: 1 } }
      service.updateModel.mockResolvedValue(mockResult as any)

      const result = await controller.updateModel('s1', 'sm1', dto as any)

      expect(service.updateModel).toHaveBeenCalledWith('s1', 'sm1', dto)
      expect(result).toBe(mockResult)
    })
  })

  describe('DELETE /scenes/:id/models/:mid', () => {
    it('应从场景移除模型', async () => {
      service.removeModel.mockResolvedValue(undefined)

      const result = await controller.removeModel('s1', 'sm1')

      expect(service.removeModel).toHaveBeenCalledWith('s1', 'sm1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('POST /scenes/:id/images', () => {
    it('应添加图片到场景', async () => {
      const dto = { name: '图片1', width: 100, height: 100 }
      const mockImage = { id: 'si1', name: '图片1' }
      service.addImage.mockResolvedValue(mockImage as any)

      const result = await controller.addImage('s1', dto as any)

      expect(service.addImage).toHaveBeenCalledWith('s1', dto)
      expect(result).toBe(mockImage)
    })
  })

  describe('PUT /scenes/:id/images/batch', () => {
    it('应批量保存场景图片', async () => {
      const dto = { images: [{ name: 'img', width: 10, height: 10 }] }
      service.batchSaveImages.mockResolvedValue(undefined)

      const result = await controller.batchSaveImages('s1', dto as any)

      expect(service.batchSaveImages).toHaveBeenCalledWith('s1', dto.images)
      expect(result).toEqual({ success: true })
    })
  })

  describe('PUT /scenes/:id/images/:iid', () => {
    it('应更新场景中的图片', async () => {
      const dto = { name: '更新图片' }
      const mockResult = { id: 'si1', name: '更新图片' }
      service.updateImage.mockResolvedValue(mockResult as any)

      const result = await controller.updateImage('s1', 'si1', dto as any)

      expect(service.updateImage).toHaveBeenCalledWith('s1', 'si1', dto)
      expect(result).toBe(mockResult)
    })
  })

  describe('DELETE /scenes/:id/images/:iid', () => {
    it('应从场景移除图片', async () => {
      service.removeImage.mockResolvedValue(undefined)

      const result = await controller.removeImage('s1', 'si1')

      expect(service.removeImage).toHaveBeenCalledWith('s1', 'si1')
      expect(result).toEqual({ success: true })
    })
  })
})
