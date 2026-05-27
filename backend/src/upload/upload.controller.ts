import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'
import { MulterFile } from '../common/types'

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: MulterFile) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件')
    }
    return this.uploadService.uploadFile(file)
  }
}
