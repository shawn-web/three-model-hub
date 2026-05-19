import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Viewpoint } from './entities/viewpoint.entity'
import { CreateViewpointDto, UpdateViewpointDto } from './dto/viewpoint.dto'

/**
 * 视点管理服务
 * 处理视点的增删改查业务逻辑
 */
@Injectable()
export class ViewpointsService {
  constructor(
    @InjectRepository(Viewpoint)
    private viewpointRepo: Repository<Viewpoint>,
  ) {}

  /**
   * 获取指定场景的所有视点
   */
  async findAll(sceneId: string): Promise<Viewpoint[]> {
    return this.viewpointRepo.find({
      where: { scene_id: sceneId },
      order: { created_at: 'DESC' },
    })
  }

  /**
   * 获取单个视点详情
   */
  async findOne(id: string): Promise<Viewpoint> {
    const viewpoint = await this.viewpointRepo.findOne({ where: { id } })
    if (!viewpoint) {
      throw new NotFoundException(`视点不存在: ${id}`)
    }
    return viewpoint
  }

  /**
   * 创建视点
   */
  async create(sceneId: string, dto: CreateViewpointDto): Promise<Viewpoint> {
    const viewpoint = this.viewpointRepo.create({
      scene_id: sceneId,
      ...dto,
    })
    return this.viewpointRepo.save(viewpoint)
  }

  /**
   * 更新视点
   */
  async update(id: string, dto: UpdateViewpointDto): Promise<Viewpoint> {
    const viewpoint = await this.findOne(id)
    Object.assign(viewpoint, dto)
    return this.viewpointRepo.save(viewpoint)
  }

  /**
   * 删除视点
   */
  async remove(id: string): Promise<void> {
    const viewpoint = await this.findOne(id)
    await this.viewpointRepo.remove(viewpoint)
  }
}
