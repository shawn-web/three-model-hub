import { Injectable } from '@nestjs/common'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class UploadService {
  constructor(private storageService: StorageService) {}

  async uploadFile(file: Express.Multer.File): Promise<{ url: string }> {
    const bucket = `upload-${Date.now()}`
    const result = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      bucket,
      'assets',
    )
    return { url: result.url }
  }
}
