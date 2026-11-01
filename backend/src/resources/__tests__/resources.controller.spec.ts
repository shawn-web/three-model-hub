import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import type { Response } from 'express'
import { ResourcesController } from '../resources.controller'
import { ResourcesService } from '../resources.service'
import { ResourceType } from '../entities/resource.entity'

/**
 * 资源管理控制器单元测试
 *
 * 覆盖路由：
 *   GET    /resources/proxy-image   图片代理
 *   GET    /resources               列表
 *   POST   /resources/upload        上传并创建资源
 *   PATCH  /resources/:id           更新资源
 *   DELETE /resources/:id            删除资源
 *   GET    /resources/groups         分组列表
 *   POST   /resources/groups         创建分组
 *   PATCH  /resources/groups/:id     更新分组
 *   DELETE /resources/groups/:id     删除分组
 */
describe('ResourcesController', () => {
  let controller: ResourcesController
  let service: jest.Mocked<ResourcesService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResourcesController],
      providers: [
        {
          provide: ResourcesService,
          useValue: {
            findAllResources: jest.fn(),
            createFromFileRef: jest.fn(),
            updateResource: jest.fn(),
            removeResource: jest.fn(),
            findAllGroups: jest.fn(),
            createGroup: jest.fn(),
            updateGroup: jest.fn(),
            removeGroup: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get(ResourcesController)
    service = module.get(ResourcesService)
  })

  describe('GET /resources', () => {
    it('应调用 findAllResources 并透传结果', async () => {
      const mockResult = { items: [], total: 0 }
      service.findAllResources.mockResolvedValue(mockResult as any)

      const result = await controller.findAll('1', '10', undefined, undefined, 'test')

      expect(service.findAllResources).toHaveBeenCalledWith({ page: 1, limit: 10, type: undefined, group_id: undefined, search: 'test' })
      expect(result).toBe(mockResult)
    })

    it('支持 type 和 group_id 筛选', async () => {
      service.findAllResources.mockResolvedValue({ items: [], total: 0 } as any)

      await controller.findAll('1', '10', ResourceType.IMAGE, 'g1', undefined)

      expect(service.findAllResources).toHaveBeenCalledWith({ page: 1, limit: 10, type: ResourceType.IMAGE, group_id: 'g1', search: undefined })
    })
  })

  describe('POST /resources/upload', () => {
    it('应调用 createFromFileRef 并返回结果', async () => {
      const dto = { name: '图片', type: ResourceType.IMAGE, url: 'https://x.com/i.png', file_key: 'k1', file_size: 1024 }
      const mockResult = { id: 'r1', name: '图片' }
      service.createFromFileRef.mockResolvedValue(mockResult as any)

      const result = await controller.upload(dto as any)

      expect(service.createFromFileRef).toHaveBeenCalledWith(dto)
      expect(result).toBe(mockResult)
    })

    it('createFromFileRef 抛出 BadRequestException 应原样抛出', async () => {
      const dto = { name: '图片', type: ResourceType.IMAGE, url: 'https://x.com/i.png', file_key: 'k1', file_size: 1024 }
      service.createFromFileRef.mockRejectedValue(new BadRequestException('文件不存在'))

      await expect(controller.upload(dto as any)).rejects.toThrow(BadRequestException)
    })

    it('其他异常应转为 InternalServerErrorException', async () => {
      const dto = { name: '图片', type: ResourceType.IMAGE, url: 'https://x.com/i.png', file_key: 'k1', file_size: 1024 }
      service.createFromFileRef.mockRejectedValue(new Error('DB 连接失败'))

      await expect(controller.upload(dto as any)).rejects.toThrow(InternalServerErrorException)
    })
  })

  describe('PATCH /resources/:id', () => {
    it('应调用 updateResource', async () => {
      const dto = { name: '更新' }
      const mockResult = { id: 'r1', name: '更新' }
      service.updateResource.mockResolvedValue(mockResult as any)

      const result = await controller.updateResource('r1', dto as any)

      expect(service.updateResource).toHaveBeenCalledWith('r1', dto)
      expect(result).toBe(mockResult)
    })
  })

  describe('DELETE /resources/:id', () => {
    it('应调用 removeResource 并返回 success', async () => {
      service.removeResource.mockResolvedValue(undefined)

      const result = await controller.removeResource('r1')

      expect(service.removeResource).toHaveBeenCalledWith('r1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('GET /resources/groups', () => {
    it('应返回分组列表', async () => {
      const mockGroups = [{ id: 'g1', name: '分组1' }]
      service.findAllGroups.mockResolvedValue(mockGroups as any)

      const result = await controller.findAllGroups()

      expect(service.findAllGroups).toHaveBeenCalled()
      expect(result).toBe(mockGroups)
    })
  })

  describe('POST /resources/groups', () => {
    it('应创建分组', async () => {
      const dto = { name: '新分组' }
      const mockGroup = { id: 'g1', name: '新分组' }
      service.createGroup.mockResolvedValue(mockGroup as any)

      const result = await controller.createGroup(dto as any)

      expect(service.createGroup).toHaveBeenCalledWith(dto)
      expect(result).toBe(mockGroup)
    })
  })

  describe('PATCH /resources/groups/:id', () => {
    it('应更新分组', async () => {
      const dto = { name: '更新' }
      const mockGroup = { id: 'g1', name: '更新' }
      service.updateGroup.mockResolvedValue(mockGroup as any)

      const result = await controller.updateGroup('g1', dto as any)

      expect(service.updateGroup).toHaveBeenCalledWith('g1', dto)
      expect(result).toBe(mockGroup)
    })
  })

  describe('DELETE /resources/groups/:id', () => {
    it('应删除分组', async () => {
      service.removeGroup.mockResolvedValue(undefined)

      const result = await controller.removeGroup('g1')

      expect(service.removeGroup).toHaveBeenCalledWith('g1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('GET /resources/proxy-image', () => {
    let mockRes: any

    beforeEach(() => {
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      }
    })

    it('缺少 url 参数应返回 400', async () => {
      await controller.proxyImage('', mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({ message: '缺少 url 参数' })
    })

    it('非 http/https 协议应返回 400', async () => {
      await controller.proxyImage('ftp://example.com/img.png', mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({ message: '仅支持 http/https 协议' })
    })

    it('内网 IP 应被拒绝返回 400', async () => {
      await controller.proxyImage('http://192.168.1.1/img.png', mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({ message: '不允许访问内网或保留地址' })
    })

    it('loopback 地址应被拒绝', async () => {
      await controller.proxyImage('http://127.0.0.1/img.png', mockRes as Response)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({ message: '不允许访问内网或保留地址' })
    })
  })
})
