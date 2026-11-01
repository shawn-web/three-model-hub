import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { ViewpointsService } from '../viewpoints.service'
import { Viewpoint } from '../entities/viewpoint.entity'

/**
 * ViewpointsService 单元测试
 *
 * 覆盖：
 *   - findAll: 按 sceneId 查询并按 created_at DESC 排序
 *   - findOne: 存在返回 / 不存在抛 404
 *   - create: 拼装 camera_position/camera_target/camera_up(可选)/fov
 *   - update: 部分字段更新（name / camera_position / camera_target / camera_up / fov）
 *   - remove: 先 findOne 再 remove
 */
describe('ViewpointsService', () => {
  let service: ViewpointsService
  let mockRepo: any

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ id: 'v1', ...dto })),
      save: jest.fn(async (e) => e),
      remove: jest.fn(async (_e) => undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewpointsService,
        { provide: getRepositoryToken(Viewpoint), useValue: mockRepo },
      ],
    }).compile()

    service = module.get<ViewpointsService>(ViewpointsService)
  })

  describe('findAll', () => {
    it('应按 sceneId 查询并排序', async () => {
      const list = [{ id: 'v1' }, { id: 'v2' }]
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
    it('存在时返回视点', async () => {
      const vp = { id: 'v1', name: '视点1' }
      mockRepo.findOne.mockResolvedValue(vp)

      const result = await service.findOne('scene-1', 'v1')

      expect(result).toEqual(vp)
    })

    it('不存在时抛 404', async () => {
      mockRepo.findOne.mockResolvedValue(null)
      await expect(service.findOne('scene-1', 'nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('应拼装 camera_position/target/up/fov 并落库', async () => {
      const dto = {
        name: '视点1',
        camera_position_x: 1, camera_position_y: 2, camera_position_z: 3,
        camera_target_x: 4, camera_target_y: 5, camera_target_z: 6,
        camera_up_x: 0, camera_up_y: 1, camera_up_z: 0,
        fov: 60,
      }

      await service.create('scene-1', dto)

      expect(mockRepo.create).toHaveBeenCalledWith({
        scene_id: 'scene-1',
        name: '视点1',
        camera_position: { x: 1, y: 2, z: 3 },
        camera_target: { x: 4, y: 5, z: 6 },
        camera_up: { x: 0, y: 1, z: 0 },
        fov: 60,
      })
      expect(mockRepo.save).toHaveBeenCalled()
    })

    it('camera_up 未传时 camera_up 为 undefined', async () => {
      const dto = {
        name: '视点2',
        camera_position_x: 1, camera_position_y: 2, camera_position_z: 3,
        camera_target_x: 4, camera_target_y: 5, camera_target_z: 6,
        fov: 45,
      }

      await service.create('scene-1', dto)

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ camera_up: undefined }),
      )
    })
  })

  describe('update', () => {
    it('只更新 name', async () => {
      const existing = {
        id: 'v1', name: '旧',
        camera_position: { x: 1, y: 2, z: 3 },
        camera_target: { x: 4, y: 5, z: 6 },
        camera_up: { x: 0, y: 1, z: 0 },
        fov: 60,
      }
      mockRepo.findOne.mockResolvedValue(existing)

      await service.update('scene-1', 'v1', { name: '新名字' })

      expect(existing.name).toBe('新名字')
      expect(mockRepo.save).toHaveBeenCalledWith(existing)
    })

    it('部分更新 camera_position 时合并', async () => {
      const existing = {
        id: 'v1', name: 'n',
        camera_position: { x: 1, y: 2, z: 3 },
        camera_target: { x: 4, y: 5, z: 6 },
        fov: 60,
      }
      mockRepo.findOne.mockResolvedValue(existing)

      await service.update('scene-1', 'v1', { camera_position_x: 10 })

      expect(existing.camera_position).toEqual({ x: 10, y: 2, z: 3 })
    })

    it('camera_up 为 undefined 时默认 {0,1,0}', async () => {
      const existing = {
        id: 'v1', name: 'n',
        camera_position: { x: 1, y: 2, z: 3 },
        camera_target: { x: 4, y: 5, z: 6 },
        camera_up: undefined,
        fov: 60,
      }
      mockRepo.findOne.mockResolvedValue(existing)

      await service.update('scene-1', 'v1', { camera_up_x: 0, camera_up_y: 1, camera_up_z: 0 })

      expect(existing.camera_up).toEqual({ x: 0, y: 1, z: 0 })
    })

    it('不存在时抛 404', async () => {
      mockRepo.findOne.mockResolvedValue(null)
      await expect(service.update('scene-1', 'nope', { name: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('存在时先查再删', async () => {
      const existing = { id: 'v1' }
      mockRepo.findOne.mockResolvedValue(existing)

      await service.remove('scene-1', 'v1')

      expect(mockRepo.remove).toHaveBeenCalledWith(existing)
    })

    it('不存在时抛 404', async () => {
      mockRepo.findOne.mockResolvedValue(null)
      await expect(service.remove('scene-1', 'nope')).rejects.toThrow(NotFoundException)
    })
  })
})