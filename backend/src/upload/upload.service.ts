import { Injectable } from '@nestjs/common'
import { StorageService } from '../storage/storage.service'
import { MulterFile } from '../common/types'

@Injectable()
export class UploadService {
  constructor(private storageService: StorageService) {}

  async uploadFile(file: MulterFile): Promise<{ url: string }> {
    try {
      const result = await this.storageService.uploadFile(
        file.buffer,
        file.originalname,
        undefined,
        undefined,
        'labs/images',
      )
      return { url: result.url }
    } catch (err) {
      console.error('[UploadService] 上传失败:', err)
      throw err
    }
  }
}
