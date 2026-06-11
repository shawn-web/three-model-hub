import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'
import { InitMultipartDto } from './dto/init-multipart.dto'
import { CompleteMultipartDto } from './dto/complete-multipart.dto'
import { AbortDto } from './dto/abort.dto'
import { UploadPartQueryDto } from './dto/upload-part.dto'
import { MAX_PART_SIZE_BYTES } from './dto/upload-part.dto'
import { MulterFile } from '../common/types'

/**
 * 上传管理 Controller
 *
 * 端点（共 6 个，全部静态路径，无动态参数冲突）：
 *   POST /upload/simple                          简单上传（< 8MB 单次）
 *   POST /upload/multipart/init                  初始化分片上传
 *   POST /upload/multipart/part                  上传单个分片
 *   POST /upload/multipart/complete              合并分片
 *   POST /upload/multipart/abort                 取消上传
 *   GET  /upload/multipart/status                查询已上传分片（断点续传）
 */
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 简单上传（< 8MB 整文件单次上传）
   * 接收 multipart/form-data 字段 file
   */
  @Post('simple')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PART_SIZE_BYTES },
    }),
  )
  async uploadSimple(
    @UploadedFile() file: MulterFile,
    @Body('bizType') bizType: string,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件')
    }
    if (!bizType) {
      throw new BadRequestException('bizType 不能为空')
    }
    return this.uploadService.uploadSimple(file, bizType)
  }

  /**
   * 初始化分片上传
   */
  @Post('multipart/init')
  async initMultipart(@Body() dto: InitMultipartDto) {
    return this.uploadService.initMultipart(dto)
  }

  /**
   * 上传单个分片
   * 接收 multipart/form-data 字段 file（原始分片字节）
   *
   * 注：用 FileInterceptor 而非 raw octet-stream body，
   *     因为 NestJS 默认 JSON bodyParser 不会把 octet-stream 字节
   *     保留为 Buffer，统一 multipart/form-data 跨平台更可控。
   */
  @Post('multipart/part')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PART_SIZE_BYTES },
    }),
  )
  async uploadPart(
    @UploadedFile() file: MulterFile,
    @Query() query: UploadPartQueryDto,
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('分片内容不能为空')
    }
    if (file.buffer.length > MAX_PART_SIZE_BYTES) {
      throw new BadRequestException(
        `分片大小不能超过 ${MAX_PART_SIZE_BYTES / 1024 / 1024}MB`,
      )
    }
    return this.uploadService.uploadPart(
      query.uploadId,
      query.partNumber,
      file.buffer,
    )
  }

  /**
   * 合并分片
   */
  @Post('multipart/complete')
  async completeMultipart(@Body() dto: CompleteMultipartDto) {
    return this.uploadService.completeMultipart(dto)
  }

  /**
   * 取消上传
   */
  @Post('multipart/abort')
  async abort(@Body() dto: AbortDto) {
    return this.uploadService.abort(dto.uploadId)
  }

  /**
   * 查询上传状态（断点续传）
   */
  @Get('multipart/status')
  async status(@Query('uploadId') uploadId: string) {
    if (!uploadId) {
      throw new BadRequestException('uploadId 不能为空')
    }
    return this.uploadService.status(uploadId)
  }
}
