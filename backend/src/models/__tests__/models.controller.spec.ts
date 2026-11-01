import { Test, TestingModule } from '@nestjs/testing'
jest.mock('@gltf-transform/core', () => ({ NodeIO: class { constructor() {} } }))
jest.mock('@gltf-transform/extensions', () => ({ EXTMeshoptCompression: class {}, EXTTextureWebP: class {} }))
jest.mock('@gltf-transform/functions', () => ({ dedup: jest.fn(), weld: jest.fn(), prune: jest.fn(), meshopt: jest.fn() }))
jest.mock('meshoptimizer', () => ({ MeshoptEncoder: {}, MeshoptDecoder: {} }))
import { NotFoundException } from '@nestjs/common'
import { Response } from 'express'
import { ModelsController } from '../models.controller'
import { ModelsService } from '../models.service'
import { ModelCompressionService } from '../model-compression.service'

/**
 * 模型管理控制器单元测试
 *
 * 覆盖路由：
 *   GET    /models                      列表（分页/搜索/标签）
 *   GET    /models/compression-tasks/:taskId  压缩任务状态
 *   GET    /models/:id/file             文件代理重定向
 *   GET    /models/:id                  详情
 *   POST   /models/create               从 URL 创建
 *   PUT    /models/:id                  更新
 *   DELETE /models/:id                  删除
 *   POST   /models/:id/versions         上传新版本
 *   GET    /models/:id/versions         版本列表
 *   GET    /models/:id/download         下载重定向
 *   POST   /models/:id/copy             复制
 *   GET    /models/:id/compare          版本对比
 *   POST   /models/:id/compress         触发压缩
 */
describe('ModelsController', () => {
  let controller: ModelsController
  let modelsService: jest.Mocked<ModelsService>
  let compressionService: jest.Mocked<ModelCompressionService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelsController],
      providers: [
        { provide: ModelsService, useValue: { findAll: jest.fn(), findOne: jest.fn(), createFromUrl: jest.fn(), update: jest.fn(), remove: jest.fn(), createVersionFromUrl: jest.fn(), getVersions: jest.fn(), copy: jest.fn(), compareVersions: jest.fn(), incrementDownloadCount: jest.fn(), getFileRedirectUrl: jest.fn() } },
        { provide: ModelCompressionService, useValue: { startCompression: jest.fn(), getTask: jest.fn() } },
      ],
    }).compile()

    controller = module.get(ModelsController)
    modelsService = module.get(ModelsService)
    compressionService = module.get(ModelCompressionService)
  })

  describe('GET /models', () => {
    it('无参数应调用 findAll 并透传结果', async () => {
      const mockResult = { items: [], total: 0, page: 1, limit: 20 }
      modelsService.findAll.mockResolvedValue(mockResult)

      const result = await controller.findAll()

      expect(modelsService.findAll).toHaveBeenCalledWith({ page: undefined, limit: undefined, search: undefined, tag: undefined })
      expect(result).toBe(mockResult)
    })

    it('应将字符串参数转为数字', async () => {
      modelsService.findAll.mockResolvedValue({ items: [], total: 0 } as any)

      await controller.findAll('2', '10', 'chair', 'furniture')

      expect(modelsService.findAll).toHaveBeenCalledWith({ page: 2, limit: 10, search: 'chair', tag: 'furniture' })
    })
  })

  describe('GET /models/compression-tasks/:taskId', () => {
    it('任务存在应返回任务状态', async () => {
      const mockTask = { taskId: 'task-1', modelId: 'm1', versionId: 'v1', progress: 50, status: 'processing' }
      compressionService.getTask.mockReturnValue(mockTask as any)

      const result = await controller.getCompressionTask('task-1')

      expect(compressionService.getTask).toHaveBeenCalledWith('task-1')
      expect(result).toBe(mockTask)
    })

    it('任务不存在应抛出 NotFoundException', async () => {
      compressionService.getTask.mockReturnValue(undefined)

      await expect(controller.getCompressionTask('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('GET /models/:id/file', () => {
    it('应设置缓存头并重定向到文件 URL', async () => {
      const mockRes = { setHeader: jest.fn(), redirect: jest.fn() } as any
      modelsService.getFileRedirectUrl.mockResolvedValue('https://minio.example.com/bucket/file.glb')

      await controller.proxyFile('uuid-1', mockRes as Response)

      expect(modelsService.getFileRedirectUrl).toHaveBeenCalledWith('uuid-1')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600')
      expect(mockRes.redirect).toHaveBeenCalledWith('https://minio.example.com/bucket/file.glb')
    })
  })

  describe('GET /models/:id', () => {
    it('应返回模型详情', async () => {
      const mockModel = { id: 'uuid-1', name: '测试模型' }
      modelsService.findOne.mockResolvedValue(mockModel as any)

      const result = await controller.findOne('uuid-1')

      expect(modelsService.findOne).toHaveBeenCalledWith('uuid-1')
      expect(result).toBe(mockModel)
    })
  })

  describe('POST /models/create', () => {
    it('应调用 createFromUrl 并平铺 model + compressionTaskId', async () => {
      const dto = { name: '新模型', file_url: 'https://x.com/m.glb', file_name: 'm.glb', file_size: 1024, file_key: 'k1' }
      const mockModel = { id: 'm1', name: '新模型', compressionTaskId: 'task-1' }
      modelsService.createFromUrl.mockResolvedValue({ model: mockModel as any, compressionTaskId: 'task-1' })

      const result = await controller.createFromUrl(dto as any)

      expect(modelsService.createFromUrl).toHaveBeenCalledWith(dto)
      expect(result).toEqual({ ...mockModel, compressionTaskId: 'task-1' })
    })
  })

  describe('PUT /models/:id', () => {
    it('应调用 update 并返回更新结果', async () => {
      const dto = { name: '更新名称' }
      const mockResult = { id: 'm1', name: '更新名称' }
      modelsService.update.mockResolvedValue(mockResult as any)

      const result = await controller.update('m1', dto as any)

      expect(modelsService.update).toHaveBeenCalledWith('m1', dto)
      expect(result).toBe(mockResult)
    })
  })

  describe('DELETE /models/:id', () => {
    it('应调用 remove 并返回 success', async () => {
      modelsService.remove.mockResolvedValue(undefined)

      const result = await controller.remove('m1')

      expect(modelsService.remove).toHaveBeenCalledWith('m1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('POST /models/:id/versions', () => {
    it('应调用 createVersionFromUrl 并平铺 version + compressionTaskId', async () => {
      const dto = { file_url: 'https://x.com/v2.glb', file_name: 'v2.glb', file_size: 2048, file_key: 'k2' }
      const mockVersion = { id: 'v2', version_number: 2 }
      modelsService.createVersionFromUrl.mockResolvedValue({ version: mockVersion as any, compressionTaskId: 'task-2' })

      const result = await controller.uploadVersion('m1', dto as any)

      expect(modelsService.createVersionFromUrl).toHaveBeenCalledWith('m1', dto)
      expect(result).toEqual({ ...mockVersion, compressionTaskId: 'task-2' })
    })
  })

  describe('GET /models/:id/versions', () => {
    it('应返回版本列表', async () => {
      const mockVersions = [{ id: 'v1', version_number: 1 }, { id: 'v2', version_number: 2 }]
      modelsService.getVersions.mockResolvedValue(mockVersions as any)

      const result = await controller.getVersions('m1')

      expect(modelsService.getVersions).toHaveBeenCalledWith('m1')
      expect(result).toBe(mockVersions)
    })
  })

  describe('GET /models/:id/download', () => {
    it('应增加下载计数并重定向到 file_url', async () => {
      const mockRes = { redirect: jest.fn() } as any
      modelsService.getFileRedirectUrl.mockResolvedValue('https://x.com/m.glb' as any)

      await controller.download('m1', mockRes as Response)

      expect(modelsService.getFileRedirectUrl).toHaveBeenCalledWith('m1')
      expect(modelsService.incrementDownloadCount).toHaveBeenCalledWith('m1')
      expect(mockRes.redirect).toHaveBeenCalledWith('https://x.com/m.glb')
    })
  })

  describe('POST /models/:id/copy', () => {
    it('应调用 copy 并返回复制结果', async () => {
      const mockCopy = { id: 'm2', name: '测试模型 (副本)' }
      modelsService.copy.mockResolvedValue(mockCopy as any)

      const result = await controller.copy('m1')

      expect(modelsService.copy).toHaveBeenCalledWith('m1')
      expect(result).toBe(mockCopy)
    })
  })

  describe('GET /models/:id/compare', () => {
    it('应调用 compareVersions 并返回对比结果', async () => {
      const mockCompare = { version1: { id: 'v1' }, version2: { id: 'v2' }, diff: { file_size: 1024 } }
      modelsService.compareVersions.mockResolvedValue(mockCompare as any)

      const result = await controller.compare('m1', 'v1', 'v2')

      expect(modelsService.compareVersions).toHaveBeenCalledWith('m1', 'v1', 'v2')
      expect(result).toBe(mockCompare)
    })
  })

  describe('POST /models/:id/compress', () => {
    it('应调用 startCompression 并返回 taskId', async () => {
      const mockResult = { taskId: 'task-1' }
      compressionService.startCompression.mockResolvedValue(mockResult as any)

      const result = await controller.compress('m1', { compressTexture: true } as any)

      expect(compressionService.startCompression).toHaveBeenCalledWith('m1', undefined, { algorithm: 'meshopt', compressTexture: true })
      expect(result).toBe(mockResult)
    })

    it('compressTexture 未传时应默认 true', async () => {
      compressionService.startCompression.mockResolvedValue({ taskId: 'task-2' } as any)

      await controller.compress('m1', {} as any)

      expect(compressionService.startCompression).toHaveBeenCalledWith('m1', undefined, { algorithm: 'meshopt', compressTexture: true })
    })
  })
})
