import { Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class UploadService {
  constructor(private storageService: StorageService) {}

  async uploadFile(file: Express.Multer.File): Promise<{ url: string }> {
    console.log('[UploadService] 开始上传文件:', file.originalname, 'size:', file.size, 'mimetype:', file.mimetype);
    try {
      const bucket = `three-mode-img-${Date.now()}-${uuidv4().slice(0, 8)}`
      const result = await this.storageService.uploadFile(
        file.buffer,
        file.originalname,
        bucket,
        undefined,
        undefined,
        'labs/images',
      )
      console.log('[UploadService] 上传成功, url:', result.url);
      return { url: result.url }
    } catch (err) {
      console.error('[UploadService] 上传失败:', err)
      throw err
    }
  }
}
