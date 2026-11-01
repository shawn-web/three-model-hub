import { DEFAULT_MINIO_BUCKET } from '../../src/minio/constants'
import type { MinioService } from '../../src/minio/minio.service'

/**
 * 构造测试用的 MinioService mock
 *
 * 各 spec 文件复用同一份默认行为，避免散落的 `getBucket: jest.fn().mockReturnValue('three-model-hub')` 重复。
 */
export function createMinioServiceMock(overrides: Partial<jest.Mocked<MinioService>> = {}): jest.Mocked<MinioService> {
  return {
    initMultipart: jest.fn(),
    uploadPart: jest.fn(),
    completeMultipart: jest.fn(),
    abortMultipart: jest.fn(),
    listParts: jest.fn(),
    putObject: jest.fn(),
    removeObject: jest.fn(),
    statObject: jest.fn(),
    getObjectPartial: jest.fn(),
    listObjects: jest.fn(),
    getObjectStream: jest.fn(),
    getPublicUrl: jest.fn(),
    getBucket: jest.fn().mockReturnValue(DEFAULT_MINIO_BUCKET),
    ...overrides,
  } as unknown as jest.Mocked<MinioService>
}