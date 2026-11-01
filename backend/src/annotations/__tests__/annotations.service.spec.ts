import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { AnnotationsService } from '../annotations.service'
import { Annotation } from '../entities/annotation.entity'

/**
 * AnnotationsService 单元测试
 *
 * 覆盖：
 *   - findAll: 按 sceneId 查询并按 created_at DESC 排序
 *   - findOne: 存在返回 / 不存在抛 404
 *   - create: 拼装 position={x,y,z} 后落库
 *   - update: 部分字段更新（text / position 合并 / 不存在抛 404）
 *   - remove: 先 findOne 再 remove
 */
describe('AnnotationsService', () => {
  let service: AnnotationsService
  let mockRepo: any

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'a1', ...dto })),
      save: jest.fn(async (e) => e),
      remove: jest.fn(async (_e) => undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnotationsService,
        { provide: getRepositoryToken(Annotation), useValue: mockRepo },
      ],
    }).compile()

    service = module.get<AnnotationsService>(AnnotationsService)
  })

  describe('findAll', () => {
    it('应按 sceneId 查询并按 created_at DESC 排序', async () => {
      const list = [{ id: 'a1' }, { id: 'a2' }]
      mockRepo.find.mockResolvedValue(list)

      const result = await service.findAll('scene-1')

      expect(result).toEqual(list)
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { scene_id: 'scene-1' },
        order: { created_at: 'DESC' },
      })
    })
  })

  describe('findOne', () => {
    it('存在时返回批注', async () => {
      const ann = { id: 'a1', text: 'hello' }
      mockRepo.findOne.mockResolvedValue(ann)

      const result = await service.findOne('scene-1', 'a1')

      expect(result).toEqual(ann)
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'a1', scene_id: 'scene-1' } })
    })

    it('不存在时抛 NotFoundException', async () => {
      mockRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('scene-1', 'nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('应拼装 position 并落库', async () => {
      const dto = { x: 1, y: 2, z: 3, text: '批注', author: '张三' }

      await service.create('scene-1', dto)

      expect(mockRepo.create).toHaveBeenCalledWith({
        scene_id: 'scene-1',
        position: { x: 1, y: 2, z: 3 },
        text: '批注',
        author: '张三',
      })
      expect(mockRepo.save).toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('只传 text 时只更新 text', async () => {
      const existing = { id: 'a1', position: { x: 1, y: 2, z: 3 }, text: '旧', author: '张三' }
      mockRepo.findOne.mockResolvedValue(existing)

      await service.update('scene-1', 'a1', { text: '新文本' })

      expect(existing.text).toBe('新文本')
      expect(existing.position).toEqual({ x: 1, y: 2, z: 3 })
      expect(mockRepo.save).toHaveBeenCalledWith(existing)
    })

    it('传 x/y/z 时合并到现有 position', async () => {
      const existing = { id: 'a1', position: { x: 1, y: 2, z: 3 }, text: 't', author: 'a' }
      mockRepo.findOne.mockResolvedValue(existing)

      await service.update('scene-1', 'a1', { x: 10, z: 30 })

      expect(existing.position).toEqual({ x: 10, y: 2, z: 30 })
    })

    it('不存在时抛 404', async () => {
      mockRepo.findOne.mockResolvedValue(null)

      await expect(service.update('scene-1', 'nope', { text: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('存在时先查再删', async () => {
      const existing = { id: 'a1' }
      mockRepo.findOne.mockResolvedValue(existing)

      await service.remove('scene-1', 'a1')

      expect(mockRepo.remove).toHaveBeenCalledWith(existing)
    })

    it('不存在时抛 404', async () => {
      mockRepo.findOne.mockResolvedValue(null)

      await expect(service.remove('scene-1', 'nope')).rejects.toThrow(NotFoundException)
    })
  })
})