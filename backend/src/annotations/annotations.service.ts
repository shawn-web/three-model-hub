import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Annotation } from './entities/annotation.entity'
import { CreateAnnotationDto, UpdateAnnotationDto } from './dto/annotation.dto'

/**
 * 批注管理服务
 * 处理批注的增删改查业务逻辑
 */
@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private annotationRepo: Repository<Annotation>,
  ) {}

  /**
   * 获取指定场景的所有批注
   */
  async findAll(sceneId: string): Promise<Annotation[]> {
    return this.annotationRepo.find({
      where: { scene_id: sceneId },
      order: { created_at: 'DESC' },
    })
  }

  /**
   * 获取单条批注详情
   */
  async findOne(sceneId: string, id: string): Promise<Annotation> {
    const annotation = await this.annotationRepo.findOne({ where: { id, scene_id: sceneId } })
    if (!annotation) {
      throw new NotFoundException(`批注不存在: ${id}`)
    }
    return annotation
  }

  /**
   * 创建批注
   */
  async create(sceneId: string, dto: CreateAnnotationDto): Promise<Annotation> {
    const annotation = this.annotationRepo.create({
      scene_id: sceneId,
      position: { x: dto.x, y: dto.y, z: dto.z },
      text: dto.text,
      author: dto.author,
    })
    return this.annotationRepo.save(annotation)
  }

  /**
   * 更新批注
   */
  async update(sceneId: string, id: string, dto: UpdateAnnotationDto): Promise<Annotation> {
    const annotation = await this.findOne(sceneId, id)
    if (dto.x !== undefined || dto.y !== undefined || dto.z !== undefined) {
      annotation.position = {
        x: dto.x ?? annotation.position.x,
        y: dto.y ?? annotation.position.y,
        z: dto.z ?? annotation.position.z,
      }
    }
    if (dto.text !== undefined) annotation.text = dto.text
    if (dto.author !== undefined) annotation.author = dto.author
    return this.annotationRepo.save(annotation)
  }

  /**
   * 删除批注
   */
  async remove(sceneId: string, id: string): Promise<void> {
    const annotation = await this.findOne(sceneId, id)
    await this.annotationRepo.remove(annotation)
  }
}
