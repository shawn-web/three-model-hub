import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { ModelsService } from './models.service'
import { CreateModelDto, UpdateModelDto, CreateVersionDto, CreateFromUrlDto, CreateVersionFromUrlDto } from './dto/model.dto'
import { MulterFile } from '../common/types'

/** 文件大小上限（MB） */
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '1024', 10)

/**
 * 模型管理控制器
 * 注意：静态路径（如 upload、create、file）必须在动态路径（:id）之前注册
 */
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.modelsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      tag,
    })
  }

  /**
   * 代理获取模型文件（302 重定向到 MinIO 公开 URL）
   * 用于 GLB 预处理（绕过 Cesium shader bug）
   * 注意：此静态路径必须放在动态路径 :id 之前
   */
  @Get(':id/file')
  async proxyFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const url = await this.modelsService.getFileRedirectUrl(id)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.redirect(url)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.modelsService.findOne(id)
  }

  /** 前端分片上传完成后，用此接口创建模型记录 */
  @Post('create')
  async createFromUrl(@Body() dto: CreateFromUrlDto) {
    return this.modelsService.createFromUrl(dto)
  }

  /** 后端代理上传（备用方案，整文件 multipart 接收，内部走 MinIO） */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 } }))
  async create(
    @UploadedFile() file: MulterFile,
    @Body() dto: CreateModelDto,
  ) {
    if (!file) throw new BadRequestException('请选择要上传的文件')
    return this.modelsService.create(file, dto)
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModelDto,
  ) {
    return this.modelsService.update(id, dto)
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.modelsService.remove(id)
    return { success: true }
  }

  /**
   * 上传新版本（前端分片上传完成后调用，JSON body 带 file_key）
   * 保留旧 multipart 路径作为备用（通过 file 字段判断走哪条路径）
   */
  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 } }))
  async uploadVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: MulterFile,
    @Body() body: Record<string, any>,
  ) {
    if (file) {
      // 旧路径：后端代理 multipart
      return this.modelsService.uploadVersion(id, file, body.commit_message)
    }
    // 新路径：前端已完成 MinIO 上传，body 含 file_url/file_key/file_size/file_name
    if (!body.file_url || !body.file_key || !body.file_size || !body.file_name) {
      throw new BadRequestException('缺少版本文件信息（file_url / file_key / file_size / file_name）')
    }
    const fileSize = typeof body.file_size === 'number' ? body.file_size : parseInt(body.file_size, 10)
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new BadRequestException('file_size 必须为正整数')
    }
    const dto = new CreateVersionFromUrlDto()
    dto.file_url = body.file_url
    dto.file_key = body.file_key
    dto.file_size = fileSize
    dto.file_name = body.file_name
    dto.commit_message = body.commit_message
    return this.modelsService.createVersionFromUrl(id, dto)
  }

  @Get(':id/versions')
  async getVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.modelsService.getVersions(id)
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const model = await this.modelsService.findOne(id)
    await this.modelsService.incrementDownloadCount(id)
    return res.redirect(model.file_url)
  }

  @Post(':id/copy')
  async copy(@Param('id', ParseUUIDPipe) id: string) {
    return this.modelsService.copy(id)
  }

  @Get(':id/compare')
  async compare(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('v1') v1: string,
    @Query('v2') v2: string,
  ) {
    return this.modelsService.compareVersions(id, v1, v2)
  }
}
