import { Test, TestingModule } from '@nestjs/testing'
import { SharingController } from '../sharing.controller'
import { SharingService } from '../sharing.service'

/**
 * 分享链接控制器单元测试
 *
 * 覆盖路由：
 *   POST   /share                  创建分享链接
 *   GET    /share/scene/:sceneId   场景分享列表
 *   GET    /share/model/:modelId   模型分享列表
 *   GET    /share/:token           通过 token 获取分享
 *   DELETE /share/:id              撤销分享
 */
describe('SharingController', () => {
  let controller: SharingController
  let service: jest.Mocked<SharingService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SharingController],
      providers: [
        {
          provide: SharingService,
          useValue: {
            create: jest.fn(),
            getBySceneId: jest.fn(),
            getByModelId: jest.fn(),
            getByToken: jest.fn(),
            revoke: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get(SharingController)
    service = module.get(SharingService)
  })

  describe('POST /share', () => {
    it('应创建分享链接并返回白名单字段', async () => {
      const dto = { scene_id: 's1' }
      const mockLink = {
        id: 'sl1',
        token: 'tokentokentokentokentokentokentokentokentokentokentokentokentoken',
        permission: 'view',
        expires_at: null,
        created_at: new Date('2026-01-01'),
      }
      service.create.mockResolvedValue(mockLink as any)

      const result = await controller.create(dto as any)

      expect(service.create).toHaveBeenCalledWith(dto)
      expect(result).toEqual({
        id: mockLink.id,
        token: mockLink.token,
        permission: mockLink.permission,
        expires_at: mockLink.expires_at,
        created_at: mockLink.created_at,
      })
    })
  })

  describe('GET /share/scene/:sceneId', () => {
    it('应返回场景的分享列表', async () => {
      const mockList = [{ id: 'sl1', scene_id: 's1' }]
      service.getBySceneId.mockResolvedValue(mockList as any)

      const result = await controller.getBySceneId('s1')

      expect(service.getBySceneId).toHaveBeenCalledWith('s1')
      expect(result).toBe(mockList)
    })
  })

  describe('GET /share/model/:modelId', () => {
    it('应返回模型的分享列表', async () => {
      const mockList = [{ id: 'sl2', model_id: 'm1' }]
      service.getByModelId.mockResolvedValue(mockList as any)

      const result = await controller.getByModelId('m1')

      expect(service.getByModelId).toHaveBeenCalledWith('m1')
      expect(result).toBe(mockList)
    })
  })

  describe('GET /share/:token', () => {
    it('应通过 token 返回分享内容', async () => {
      const mockLink = { token: 'abc', scene: { id: 's1' } }
      service.getByToken.mockResolvedValue(mockLink as any)

      const result = await controller.getByToken('abc')

      expect(service.getByToken).toHaveBeenCalledWith('abc')
      expect(result).toBe(mockLink)
    })
  })

  describe('DELETE /share/:id', () => {
    it('应撤销分享并返回 success', async () => {
      service.revoke.mockResolvedValue(undefined)

      const result = await controller.revoke('sl1')

      expect(service.revoke).toHaveBeenCalledWith('sl1')
      expect(result).toEqual({ success: true })
    })
  })
})
