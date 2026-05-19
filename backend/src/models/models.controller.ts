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
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { ModelsService } from './models.service'
import { CreateModelDto, UpdateModelDto, CreateVersionDto, CreateFromUrlDto } from './dto/model.dto'

/** 上传文件类型 */
type UploadedFile = { buffer: Buffer; originalname: string; size: number; mimetype: string }

/**
 * 模型管理控制器
 * 注意：静态路径（如 upload-config、upload、create）必须在动态路径（:id）之前注册
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

  /** 获取文件上传配置（两段路径，不可能与 :id 单段路径冲突） */
  @Get('upload/config')
  getUploadConfig() {
    return this.modelsService.getUploadConfig()
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.modelsService.findOne(id)
  }

  /** 前端直传文件服务后，用此接口创建模型记录 */
  @Post('create')
  async createFromUrl(@Body() dto: CreateFromUrlDto) {
    return this.modelsService.createFromUrl(dto)
  }

  /** 通过后端转发上传（备用方案） */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async create(
    @UploadedFile() file: UploadedFile,
    @Body() dto: CreateModelDto,
  ) {
    if (!file) throw new Error('请选择要上传的文件')
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

  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async uploadVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFile,
    @Body() dto: CreateVersionDto,
  ) {
    if (!file) throw new Error('请选择要上传的文件')
    return this.modelsService.uploadVersion(id, file, dto.commit_message)
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
