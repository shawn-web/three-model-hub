import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Res,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common'
import { Response } from 'express'
import { ModelsService } from './models.service'
import { UpdateModelDto, CreateFromUrlDto, CreateVersionFromUrlDto } from './dto/model.dto'
import { ModelCompressionService, CompressionOptions } from './model-compression.service'
import { CreateCompressionDto } from './dto/compression.dto'

/**
 * 模型管理控制器
 * 注意：静态路径（如 create、compression-tasks）必须在动态路径（:id）之前注册，
 * 否则会被 :id 匹配后经 ParseUUIDPipe 校验失败而返回 400。
 */
@Controller('models')
export class ModelsController {
  constructor(
    private readonly modelsService: ModelsService,
    private readonly compressionService: ModelCompressionService,
  ) {}

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

  /** 查询压缩任务状态（前端轮询）。必须在动态 :id 之前注册 */
  @Get('compression-tasks/:taskId')
  async getCompressionTask(@Param('taskId') taskId: string) {
    const task = this.compressionService.getTask(taskId)
    if (!task) {
      throw new NotFoundException(`任务不存在或已过期：${taskId}`)
    }
    return task
  }

  /**
   * 代理获取模型文件（302 重定向到 MinIO 公开 URL）
   * 用于 GLB 预处理（绕过 Cesium shader bug）
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
    const { model, compressionTaskId } = await this.modelsService.createFromUrl(dto)
    // 把 model 字段平铺到响应顶层，前端原有调用 (data.name 等) 不需要改
    // 同时附带 compressionTaskId 用于前端轮询压缩进度
    return { ...model, compressionTaskId }
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
   */
  @Post(':id/versions')
  async uploadVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionFromUrlDto,
  ) {
    const { version, compressionTaskId } = await this.modelsService.createVersionFromUrl(id, dto)
    return { ...version, compressionTaskId }
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
    const url = await this.modelsService.getFileRedirectUrl(id)
    await this.modelsService.incrementDownloadCount(id)
    return res.redirect(url)
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

  /* ────────────── 压缩接口 ────────────── */

  /**
   * 异步触发模型压缩
   * Body 可指定：compressTexture（默认 true）+ versionId（默认 latest）
   * 返回 { taskId }，前端轮询 GET /models/compression-tasks/:taskId 获取进度
   */
  @Post(':id/compress')
  async compress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCompressionDto,
  ) {
    const options: CompressionOptions = {
      algorithm: 'meshopt',
      compressTexture: body.compressTexture ?? true,
    }
    return this.compressionService.startCompression(id, body.versionId, options)
  }
}