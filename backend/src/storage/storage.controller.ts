import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { MinioService } from '../minio/minio.service'

/**
 * 对象存储代理读取 Controller
 *
 * 路径：
 *   GET /api/storage/:bucket          → 列出 bucket 中所有文件（管理用）
 *   GET /api/storage/:bucket/*        → 代理下载具体文件
 *
 * 说明：
 *   - 前端拿到 upload 返回的 url（如 /api/storage/three-mode/labs/models/...glb）
 *     后直接 <img src>、fetch、three.js GLTFLoader 都用
 *   - 后端从 MinIO 流式读取后透传（不缓存，避免大文件占内存）
 *
 * 安全：
 *   - 仅代理本服务配置的 bucket（防越权访问其他 bucket）
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly minioService: MinioService) {}

  /**
   * 列出 bucket 中的文件
   * GET /api/storage/:bucket?prefix=labs/models
   * 注意：此路由必须在通配符路由之前声明（静态优先于动态）
   */
  @Get(':bucket')
  async listFiles(
    @Param('bucket') bucket: string,
    @Query('prefix') prefix?: string,
  ) {
    if (bucket !== this.minioService.getBucket()) {
      throw new NotFoundException(`bucket '${bucket}' 不存在`)
    }
    const objects = await this.minioService.listObjects(prefix)
    return {
      bucket,
      total: objects.length,
      objects: objects.map((o) => ({
        key: o.name,
        size: o.size,
        lastModified: o.lastModified,
        url: `/api/storage/${bucket}/${o.name}`,
      })),
    }
  }

  @Get(':bucket/*')
  async proxy(
    @Param('bucket') bucket: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // 1. bucket 必须是当前服务配置的（防越权）
    if (bucket !== this.minioService.getBucket()) {
      throw new NotFoundException(`bucket '${bucket}' 不存在`)
    }

    // 2. key 从 req.url 解析（去掉 /api/storage/{bucket}/ 前缀）
    //    NestJS 11 wildcard 段不能稳定通过 @Param('0') 取到值，改用 URL 解析
    const prefix = `/api/storage/${bucket}/`
    const url = req.originalUrl || req.url
    if (!url.startsWith(prefix)) {
      throw new BadRequestException(`URL 格式错误：${url}`)
    }
    const objectKey = decodeURIComponent(url.slice(prefix.length)).replace(/^\/+/, '')
    if (!objectKey) {
      throw new BadRequestException('objectKey 不能为空')
    }

    try {
      const { stream, size, contentType, etag, lastModified } =
        await this.minioService.getObjectStream(objectKey)

      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', String(size))
      res.setHeader('ETag', etag)
      res.setHeader('Last-Modified', lastModified.toUTCString())
      res.setHeader('Accept-Ranges', 'bytes')
      // 允许前端跨域（虽然此时同源，但保险起见）
      res.setHeader('Access-Control-Allow-Origin', '*')

      // 流式 pipe 到响应
      stream.pipe(res)
    } catch (e: any) {
      if (e?.code === 'NotFound' || e?.code === 'NoSuchKey') {
        throw new NotFoundException(`文件不存在：${objectKey}`)
      }
      throw e
    }
  }
}