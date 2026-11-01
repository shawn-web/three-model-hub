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
  ParseUUIDPipe,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import type { Response } from 'express'
import axios from 'axios'
import * as dns from 'dns'
import * as http from 'http'
import * as https from 'https'
import { ResourcesService } from './resources.service'
import { ResourceType } from './entities/resource.entity'
import {
  UploadResourceDto,
  UpdateResourceDto,
  CreateResourceGroupDto,
  UpdateResourceGroupDto,
} from './dto/resource.dto'

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
      // SSRF 加固：拒绝 IPv6 字面量（resolve4 不会返回 IPv6，会绕过 IPv4 校验）
      const urlObj = new URL(url)
      if (urlObj.hostname.includes(':') || urlObj.hostname.includes('[')) {
        res.status(400).json({ message: '不支持 IPv6 地址' })
        return
      }

      // DNS 解析检查，防止 SSRF 访问内网地址
      const ipv4Literal = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(urlObj.hostname)
      const addresses = ipv4Literal ? [urlObj.hostname] : await dns.promises.resolve4(urlObj.hostname)
      if (addresses.length === 0 || addresses.some((addr) => isPrivateIP(addr))) {
        res.status(400).json({ message: '不允许访问内网或保留地址' })
        return
      }

      // 固定 DNS 解析结果到已校验的 IP，防止 DNS rebinding（TOCTOU）绕过
      const resolvedIP = addresses[0]
      const isHttps = urlObj.protocol === 'https:'
      const agent = isHttps
        ? new https.Agent({ lookup: (_hostname: string, opts: any, cb: any) => cb(null, resolvedIP, 4) })
        : new http.Agent({ lookup: (_hostname: string, opts: any, cb: any) => cb(null, resolvedIP, 4) })

      // 跟随重定向但在每次重定向前校验目标 URL，防止 SSRF 跳转到内网
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5,
        httpAgent: agent,
        httpsAgent: isHttps ? agent : undefined,
        beforeRedirect: async (options, response) => {
          const location = response.headers.location
          if (!location) return
          try {
            const redirectUrl = new URL(location, url)
            // 重定向目标也必须走 http/https
            if (!redirectUrl.protocol.startsWith('http')) {
              throw new Error('重定向目标协议不允许')
            }
            // 重定向目标也做 IPv6 字面量检查
            if (redirectUrl.hostname.includes(':') || redirectUrl.hostname.includes('[')) {
              throw new Error('重定向目标不支持 IPv6 地址')
            }
            // 重定向目标也做 DNS 校验
            const redirectLiteral = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(redirectUrl.hostname)
            const redirectAddrs = redirectLiteral ? [redirectUrl.hostname] : await dns.promises.resolve4(redirectUrl.hostname)
            if (redirectAddrs.length === 0 || redirectAddrs.some((addr) => isPrivateIP(addr))) {
              throw new Error('重定向目标不允许访问内网或保留地址')
            }
          } catch (e: any) {
            // 将校验失败转为取消请求的错误
            throw new Error(`重定向校验失败: ${e?.message || e}`)
          }
        },
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
   * 上传并创建资源（前端分片上传完成后落库）
   * 流程：前端先走 /upload/* 完成 MinIO 上传，再调此接口传 file_key/url/file_size 等字段落库
   */
  @Post('upload')
  async upload(@Body() body: UploadResourceDto) {
    try {
      return await this.resourcesService.createFromFileRef(body)
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      // 服务端日志保留完整错误（含 MinIO/TypeORM 内部信息便于排障），
      // 但不回显给客户端以避免泄露内部基础设施细节
      console.error('[资源上传] 失败:', err)
      throw new InternalServerErrorException('文件上传失败，请稍后重试')
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

/** 检查 IPv4 是否为内网/保留地址（fail-closed：解析失败也判为内网） */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true
  }
  const [a, b] = parts
  // 0.0.0.0/8
  if (a === 0) return true
  // 10.0.0.0/8
  if (a === 10) return true
  // 127.0.0.0/8（loopback）
  if (a === 127) return true
  // 169.254.0.0/16（链路本地 + 云元数据 169.254.169.254）
  if (a === 169 && b === 254) return true
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true
  // 100.64.0.0/10（CGNAT）
  if (a === 100 && b >= 64 && b <= 127) return true
  // 224.0.0.0/4（多播）+ 240/4（保留）+ 255.255.255.255（广播）
  if (a >= 224) return true
  return false
}
