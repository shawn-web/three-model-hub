import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import axios from 'axios'
import * as dns from 'dns'
import { ResourcesService } from './resources.service'
import { ResourceType } from './entities/resource.entity'
import {
  UpdateResourceDto,
  CreateResourceGroupDto,
  UpdateResourceGroupDto,
} from './dto/resource.dto'
import { MulterFile } from '../common/types'

/** 文件大小上限（MB） */
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '1024', 10)

/**
 * 资源管理控制器
 */
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  /**
   * 代理图片加载
   * 前端通过此端点间接加载外部图片，避免 WebGL 跨域纹理问题
   */
  @Get('proxy-image')
  async proxyImage(@Query('url') url: string, @Res() res: Response): Promise<void> {
    if (!url) {
      res.status(400).json({ message: '缺少 url 参数' })
      return
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      res.status(400).json({ message: '仅支持 http/https 协议' })
      return
    }

    try {
      // DNS 解析检查，防止 SSRF 访问内网地址
      const urlObj = new URL(url)
      const addresses = await dns.promises.resolve4(urlObj.hostname)
      for (const addr of addresses) {
        if (isPrivateIP(addr)) {
          res.status(400).json({ message: '不允许访问内网地址' })
          return
        }
      }

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      })
      const contentType = (response.headers['content-type'] as string) || 'application/octet-stream'
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.send(response.data)
    } catch (err) {
      console.error('[ResourcesController] 代理图片失败:', (err as Error).message)
      res.status(502).json({ message: '代理图片加载失败' })
    }
  }

  /** 获取资源列表 */
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: ResourceType,
    @Query('group_id') group_id?: string,
    @Query('search') search?: string,
  ) {
    return this.resourcesService.findAllResources({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      type,
      group_id,
      search,
    })
  }

  /**
   * 上传并创建资源
   * 支持两种模式：
   *   - 新模式（JSON body）：前端先走 /upload/* 完成 MinIO 上传，再传 file_key/url/file_size 等字段落库
   *   - 旧模式（multipart）：后端代理上传（FileInterceptor 接收文件，内部走 MinIO）
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: MulterFile,
    @Body() body: Record<string, any>,
  ) {
    try {
      if (file) {
        // 旧路径：后端代理 multipart 上传
        return await this.resourcesService.uploadAndCreate(file, {
          name: body.name || file.originalname,
          type: body.type || ResourceType.IMAGE,
          group_id: body.group_id || undefined,
          width: body.width ? parseInt(body.width, 10) : undefined,
          height: body.height ? parseInt(body.height, 10) : undefined,
          duration: body.duration ? parseFloat(body.duration) : undefined,
          mime_type: body.mime_type || undefined,
        })
      }

      // 新路径：前端已完成 MinIO 上传，JSON body 带 file_key/url/file_size
      if (!body.file_key || !body.url || !body.file_size) {
        throw new BadRequestException('缺少文件信息（file_key / url / file_size）')
      }
      return await this.resourcesService.createFromFileRef({
        name: body.name || '未命名资源',
        type: body.type || ResourceType.IMAGE,
        url: body.url,
        file_key: body.file_key,
        file_size: typeof body.file_size === 'number' ? body.file_size : parseInt(body.file_size, 10),
        mime_type: body.mime_type,
        width: body.width ? parseInt(body.width, 10) : undefined,
        height: body.height ? parseInt(body.height, 10) : undefined,
        duration: body.duration ? parseFloat(body.duration) : undefined,
        group_id: body.group_id,
      })
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      console.error('[资源上传] 失败:', err)
      throw new InternalServerErrorException(
        `文件上传失败: ${err instanceof Error ? err.message : '未知错误'}`,
      )
    }
  }

  /** 更新资源 */
  @Patch(':id')
  async updateResource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourcesService.updateResource(id, dto)
  }

  /** 删除资源 */
  @Delete(':id')
  async removeResource(@Param('id', ParseUUIDPipe) id: string) {
    await this.resourcesService.removeResource(id)
    return { success: true }
  }

  // ===== 分组接口 =====

  /** 获取分组列表 */
  @Get('groups')
  async findAllGroups() {
    return this.resourcesService.findAllGroups()
  }

  /** 创建分组 */
  @Post('groups')
  async createGroup(@Body() dto: CreateResourceGroupDto) {
    return this.resourcesService.createGroup(dto)
  }

  /** 更新分组 */
  @Patch('groups/:id')
  async updateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceGroupDto,
  ) {
    return this.resourcesService.updateGroup(id, dto)
  }

  /** 删除分组 */
  @Delete('groups/:id')
  async removeGroup(@Param('id', ParseUUIDPipe) id: string) {
    await this.resourcesService.removeGroup(id)
    return { success: true }
  }
}

/** 检查 IP 是否为内网/保留地址 */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  // 10.0.0.0/8
  if (parts[0] === 10) return true
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true
  // 127.0.0.0/8
  if (parts[0] === 127) return true
  // 0.0.0.0
  if (parts[0] === 0) return true
  return false
}
