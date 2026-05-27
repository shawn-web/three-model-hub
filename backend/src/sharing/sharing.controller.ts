import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common'
import { SharingService } from './sharing.service'
import { CreateShareLinkDto } from './dto/share.dto'

/**
 * 分享链接控制器
 * 注意：静态路径（scene/:sceneId、model/:modelId）必须在 :token 之前注册
 */
@Controller('share')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  /** 创建分享链接 */
  @Post()
  async create(@Body() dto: CreateShareLinkDto) {
    const link = await this.sharingService.create(dto)
    return {
      id: link.id,
      token: link.token,
      permission: link.permission,
      expires_at: link.expires_at,
      created_at: link.created_at,
    }
  }

  /** 获取场景的分享链接列表（静态路径，必须在 :token 之前） */
  @Get('scene/:sceneId')
  async getBySceneId(@Param('sceneId', ParseUUIDPipe) sceneId: string) {
    return this.sharingService.getBySceneId(sceneId)
  }

  /** 获取模型的分享链接列表（静态路径，必须在 :token 之前） */
  @Get('model/:modelId')
  async getByModelId(@Param('modelId', ParseUUIDPipe) modelId: string) {
    return this.sharingService.getByModelId(modelId)
  }

  /** 通过 token 获取分享内容（公开访问，无需认证） */
  @Get(':token')
  async getByToken(@Param('token') token: string) {
    return this.sharingService.getByToken(token)
  }

  /** 撤销分享链接 */
  @Delete(':id')
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    await this.sharingService.revoke(id)
    return { success: true }
  }
}
