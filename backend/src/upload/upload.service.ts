import { Injectable } from '@nestjs/common'
import { StorageService } from '../storage/storage.service'

export interface MulterFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  buffer: Buffer
}

@Injectable()
export class UploadService {
  constructor(private storageService: StorageService) {}

  async uploadFile(file: MulterFile): Promise<{ url: string }> {
    console.log('[UploadService] 开始上传文件:', file.originalname, 'size:', file.size, 'mimetype:', file.mimetype);
    try {
      const result = await this.storageService.uploadFile(
        file.buffer,
        file.originalname,
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
