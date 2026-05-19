import { Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class UploadService {
  constructor(private storageService: StorageService) {}

  async uploadFile(file: Express.Multer.File): Promise<{ url: string }> {
    // 使用与模型上传一致的 bucket 命名规范，确保唯一性
    const bucket = `three-mode-img-${Date.now()}-${uuidv4().slice(0, 8)}`
    const result = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      bucket,
      undefined,
      undefined,
      'labs/images',
    )
    return { url: result.url }
  }
}
