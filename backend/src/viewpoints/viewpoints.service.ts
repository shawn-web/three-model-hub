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
  async findOne(sceneId: string, id: string): Promise<Viewpoint> {
    const viewpoint = await this.viewpointRepo.findOne({ where: { id, scene_id: sceneId } })
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
      name: dto.name,
      camera_position: { x: dto.camera_position_x, y: dto.camera_position_y, z: dto.camera_position_z },
      camera_target: { x: dto.camera_target_x, y: dto.camera_target_y, z: dto.camera_target_z },
      camera_up: dto.camera_up_x !== undefined
        ? { x: dto.camera_up_x, y: dto.camera_up_y, z: dto.camera_up_z }
        : undefined,
      fov: dto.fov,
    })
    return this.viewpointRepo.save(viewpoint)
  }

  /**
   * 更新视点
   */
  async update(sceneId: string, id: string, dto: UpdateViewpointDto): Promise<Viewpoint> {
    const viewpoint = await this.findOne(sceneId, id)
    if (dto.name !== undefined) viewpoint.name = dto.name
    if (dto.camera_position_x !== undefined || dto.camera_position_y !== undefined || dto.camera_position_z !== undefined) {
      viewpoint.camera_position = {
        x: dto.camera_position_x ?? viewpoint.camera_position.x,
        y: dto.camera_position_y ?? viewpoint.camera_position.y,
        z: dto.camera_position_z ?? viewpoint.camera_position.z,
      }
    }
    if (dto.camera_target_x !== undefined || dto.camera_target_y !== undefined || dto.camera_target_z !== undefined) {
      viewpoint.camera_target = {
        x: dto.camera_target_x ?? viewpoint.camera_target.x,
        y: dto.camera_target_y ?? viewpoint.camera_target.y,
        z: dto.camera_target_z ?? viewpoint.camera_target.z,
      }
    }
    if (dto.camera_up_x !== undefined || dto.camera_up_y !== undefined || dto.camera_up_z !== undefined) {
      viewpoint.camera_up = {
        x: dto.camera_up_x ?? viewpoint.camera_up?.x ?? 0,
        y: dto.camera_up_y ?? viewpoint.camera_up?.y ?? 1,
        z: dto.camera_up_z ?? viewpoint.camera_up?.z ?? 0,
      }
    }
    if (dto.fov !== undefined) viewpoint.fov = dto.fov
    return this.viewpointRepo.save(viewpoint)
  }

  /**
   * 删除视点
   */
  async remove(sceneId: string, id: string): Promise<void> {
    const viewpoint = await this.findOne(sceneId, id)
    await this.viewpointRepo.remove(viewpoint)
  }
}
