import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { SharingService } from '../sharing.service'
import { ShareLink } from '../entities/share-link.entity'

/**
 * SharingService 单元测试
 *
 * 覆盖：
 *   - create: 缺 scene_id 和 model_id 抛 400 / 正常创建 token 和 expires_at
 *   - getByToken: 不存在/失效/过期/正常
 *   - revoke: 不存在抛 404 / 正常置 is_active=false
 *   - getBySceneId / getByModelId
 */
describe('SharingService', () => {
  let service: SharingService
  let mockRepo: any

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((dto) => ({ id: 's1', access_count: 0, ...dto })),
      save: jest.fn(async (e) => e),
      findOne: jest.fn(),
      find: jest.fn(),
      increment: jest.fn(async () => undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharingService,
        { provide: getRepositoryToken(ShareLink), useValue: mockRepo },
      ],
    }).compile()

    service = module.get<SharingService>(SharingService)
  })

  describe('create', () => {
    it('缺 scene_id 和 model_id 时抛 BadRequestException', async () => {
      await expect(service.create({} as any)).rejects.toThrow(BadRequestException)
    })

    it('正常创建：生成 32 位 hex token，无 expires_hours 时 expires_at 为 null', async () => {
      const result = await service.create({ scene_id: 'scene-1' })

      expect(result.token).toMatch(/^[0-9a-f]{32}$/)
      expect(result.expires_at).toBeNull()
      expect(result.permission).toBe('view')
      expect(result.scene_id).toBe('scene-1')
      expect(result.model_id).toBeNull()
      expect(mockRepo.save).toHaveBeenCalled()
    })

    it('有 expires_hours 时 expires_at 不为 null', async () => {
      const result = await service.create({ model_id: 'm1', expires_hours: 24 })

      expect(result.expires_at).toBeInstanceOf(Date)
      expect(result.model_id).toBe('m1')
    })

    it('permission=download 时正确保存', async () => {
      const result = await service.create({ scene_id: 's1', permission: 'download' })

      expect(result.permission).toBe('download')
    })
  })

  describe('getByToken', () => {
    it('不存在时抛 NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue(null)

      await expect(service.getByToken('nope')).rejects.toThrow(NotFoundException)
    })

    it('is_active=false 时抛 NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 's1', token: 't', is_active: false })

      await expect(service.getByToken('t')).rejects.toThrow(NotFoundException)
    })

    it('过期时抛 NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 's1', token: 't', is_active: true,
        expires_at: new Date(Date.now() - 3600000),
      })

      await expect(service.getByToken('t')).rejects.toThrow(NotFoundException)
    })

    it('正常时增加 access_count 并返回 link', async () => {
      const link = {
        id: 's1', token: 't', is_active: true,
        expires_at: null, access_count: 0,
      }
      mockRepo.findOne.mockResolvedValue(link)

      const result = await service.getByToken('t')

      expect(result).toEqual(link)
      expect(mockRepo.increment).toHaveBeenCalledWith({ id: 's1' }, 'access_count', 1)
    })

    it('查询时应加载 scene 和 model 关联', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 's1', token: 't', is_active: true, expires_at: null,
      })

      await service.getByToken('t')

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { token: 't' },
        relations: ['scene', 'model'],
      })
    })
  })

  describe('revoke', () => {
    it('不存在时抛 404', async () => {
      mockRepo.findOne.mockResolvedValue(null)

      await expect(service.revoke('nope')).rejects.toThrow(NotFoundException)
    })

    it('正常时置 is_active=false 后 save', async () => {
      const link = { id: 's1', is_active: true }
      mockRepo.findOne.mockResolvedValue(link)

      await service.revoke('s1')

      expect(link.is_active).toBe(false)
      expect(mockRepo.save).toHaveBeenCalledWith(link)
    })
  })

  describe('getBySceneId', () => {
    it('应按 scene_id 查询并排序', async () => {
      const list = [{ id: 's1' }, { id: 's2' }]
      mockRepo.find.mockResolvedValue(list)

      const result = await service.getBySceneId('scene-1')

      expect(result).toEqual(list)
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { scene_id: 'scene-1' },
        order: { created_at: 'DESC' },
      })
    })
  })

  describe('getByModelId', () => {
    it('应按 model_id 查询并排序', async () => {
      const list = [{ id: 's1' }]
      mockRepo.find.mockResolvedValue(list)

      const result = await service.getByModelId('m1')

      expect(result).toEqual(list)
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { model_id: 'm1' },
        order: { created_at: 'DESC' },
      })
    })
  })
})