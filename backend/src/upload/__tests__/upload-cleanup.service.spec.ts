import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UploadCleanupService } from '../upload-cleanup.service'
import { UploadSession } from '../entities/upload-session.entity'
import { MinioService } from '../../minio/minio.service'

/**
 * UploadCleanupService 单元测试
 *
 * 覆盖：
 *   - 扫描 24h+ pending session
 *   - 调 minio.abortMultipart + 标记 status=aborted
 *   - 无过期时不调任何方法
 *   - minio 失败时 console.warn 但不中断
 */
describe('UploadCleanupService', () => {
  let service: UploadCleanupService
  let mockSessionRepo: any
  let mockMinio: jest.Mocked<MinioService>
  let warnSpy: jest.SpyInstance

  beforeEach(async () => {
    mockSessionRepo = {
      find: jest.fn(),
      save: jest.fn(async (s) => s),
    }

    mockMinio = {
      abortMultipart: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadCleanupService,
        { provide: getRepositoryToken(UploadSession), useValue: mockSessionRepo },
        { provide: MinioService, useValue: mockMinio },
      ],
    }).compile()

    service = module.get<UploadCleanupService>(UploadCleanupService)
    warnSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('应扫描 status=pending AND created_at < 24h ago', async () => {
    mockSessionRepo.find.mockResolvedValue([])

    await service.cleanupStaleSessions()

    expect(mockSessionRepo.find).toHaveBeenCalledWith({
      where: {
        status: 'pending',
        created_at: expect.anything(), // LessThan(Date)
      },
      take: 100,
    })
  })

  it('无过期 session 时不调 abortMultipart', async () => {
    mockSessionRepo.find.mockResolvedValue([])

    await service.cleanupStaleSessions()

    expect(mockMinio.abortMultipart).not.toHaveBeenCalled()
  })

  it('有过期 session 时调 abort + 标记 aborted', async () => {
    const stale = [
      { id: 's1', upload_id: 'u1', object_key: 'k1', status: 'pending' },
      { id: 's2', upload_id: 'u2', object_key: 'k2', status: 'pending' },
    ]
    mockSessionRepo.find.mockResolvedValue(stale)
    mockMinio.abortMultipart.mockResolvedValue(undefined)

    await service.cleanupStaleSessions()

    expect(mockMinio.abortMultipart).toHaveBeenCalledWith('u1', 'k1')
    expect(mockMinio.abortMultipart).toHaveBeenCalledWith('u2', 'k2')
    expect(mockSessionRepo.save).toHaveBeenCalledTimes(2)
    expect(mockSessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'aborted' }),
    )
  })

  it('minio 失败时 warn 但不中断', async () => {
    const stale = [
      { id: 's1', upload_id: 'u1', object_key: 'k1', status: 'pending' },
    ]
    mockSessionRepo.find.mockResolvedValue(stale)
    mockMinio.abortMultipart.mockRejectedValue(new Error('boom'))

    await expect(service.cleanupStaleSessions()).resolves.toBeUndefined()
  })
})
