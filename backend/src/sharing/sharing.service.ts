import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as crypto from 'crypto'
import { ShareLink } from './entities/share-link.entity'
import { CreateShareLinkDto } from './dto/share.dto'

/**
 * 分享链接服务
 */
@Injectable()
export class SharingService {
  constructor(
    @InjectRepository(ShareLink)
    private shareRepo: Repository<ShareLink>,
  ) {}

  /** 创建分享链接 */
  async create(dto: CreateShareLinkDto): Promise<ShareLink> {
    if (!dto.scene_id && !dto.model_id) {
      throw new BadRequestException('必须指定 scene_id 或 model_id')
    }

    const token = crypto.randomBytes(16).toString('hex')
    let expiresAt: Date | null = null
    if (dto.expires_hours) {
      expiresAt = new Date(Date.now() + dto.expires_hours * 3600000)
    }

    const link = this.shareRepo.create({
      token,
      scene_id: dto.scene_id || null,
      model_id: dto.model_id || null,
      permission: dto.permission || 'view',
      expires_at: expiresAt,
    })
    return this.shareRepo.save(link)
  }

  /** 通过 token 获取分享内容 */
  async getByToken(token: string): Promise<ShareLink> {
    const link = await this.shareRepo.findOne({
      where: { token },
      relations: ['scene', 'model'],
    })
    if (!link) {
      throw new NotFoundException('分享链接不存在')
    }
    if (!link.is_active) {
      throw new NotFoundException('分享链接已失效')
    }
    if (link.expires_at && new Date() > link.expires_at) {
      throw new NotFoundException('分享链接已过期')
    }

    // 增加访问计数
    await this.shareRepo.increment({ id: link.id }, 'access_count', 1)
    return link
  }

  /** 撤销分享链接 */
  async revoke(id: string): Promise<void> {
    const link = await this.shareRepo.findOne({ where: { id } })
    if (!link) {
      throw new NotFoundException('分享链接不存在')
    }
    link.is_active = false
    await this.shareRepo.save(link)
  }

  /** 获取场景的所有分享链接 */
  async getBySceneId(sceneId: string): Promise<ShareLink[]> {
    return this.shareRepo.find({
      where: { scene_id: sceneId },
      order: { created_at: 'DESC' },
    })
  }

  /** 获取模型的所有分享链接 */
  async getByModelId(modelId: string): Promise<ShareLink[]> {
    return this.shareRepo.find({
      where: { model_id: modelId },
      order: { created_at: 'DESC' },
    })
  }
}
