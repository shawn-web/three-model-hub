import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Resource, ResourceType } from './entities/resource.entity'
import { ResourceGroup } from './entities/resource-group.entity'
import { StorageService } from '../storage/storage.service'
import {
  UploadResourceDto,
  UpdateResourceDto,
  CreateResourceGroupDto,
  UpdateResourceGroupDto,
} from './dto/resource.dto'

/**
 * 资源管理服务
 */
@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name)

  constructor(
    @InjectRepository(Resource)
    private resourceRepo: Repository<Resource>,
    @InjectRepository(ResourceGroup)
    private groupRepo: Repository<ResourceGroup>,
    private storageService: StorageService,
  ) {}

  /** 获取资源列表（分页+筛选） */
  async findAllResources(query: {
    page?: number
    limit?: number
    type?: ResourceType
    group_id?: string
    search?: string
  }) {
    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const qb = this.resourceRepo.createQueryBuilder('r')

    if (query.type) {
      qb.andWhere('r.type = :type', { type: query.type })
    }
    if (query.group_id === 'ungrouped' || query.group_id === 'null') {
      qb.andWhere('r.group_id IS NULL')
    } else if (query.group_id) {
      qb.andWhere('r.group_id = :groupId', { groupId: query.group_id })
    }
    if (query.search) {
      qb.andWhere('r.name LIKE :search', { search: `%${query.search}%` })
    }

    qb.orderBy('r.created_at', 'DESC')
      .skip(offset)
      .take(limit)

    const [items, total] = await qb.getManyAndCount()
    return { items, total, page, limit }
  }

  /** 获取单个资源 */
  async findOneResource(id: string): Promise<Resource> {
    const resource = await this.resourceRepo.findOne({ where: { id } })
    if (!resource) {
      throw new NotFoundException(`资源不存在: ${id}`)
    }
    return resource
  }

  /** 创建资源记录 */
  async createResource(dto: {
    name: string
    type: ResourceType
    url: string
    file_size?: number
    mime_type?: string
    width?: number
    height?: number
    duration?: number
    thumbnail_url?: string
    group_id?: string
    file_key?: string
  }): Promise<Resource> {
    const resource = this.resourceRepo.create(dto)
    return this.resourceRepo.save(resource)
  }

  /** 更新资源 */
  async updateResource(id: string, dto: UpdateResourceDto): Promise<Resource> {
    const resource = await this.findOneResource(id)
    Object.assign(resource, dto)
    return this.resourceRepo.save(resource)
  }

  /** 删除资源 */
  async removeResource(id: string): Promise<void> {
    const resource = await this.findOneResource(id)
    // 尝试删除远程文件
    if (resource.file_key) {
      try {
        await this.storageService.deleteFile(resource.file_key)
      } catch {
        // 远程文件删除失败不影响记录删除
      }
    }
    await this.resourceRepo.remove(resource)
  }

  /**
   * 前端已完成 MinIO 上传后创建资源（JSON body 含 file_key/url/file_size）
   * 流程：前端先调 /upload/* 完成 MinIO 上传，再调此接口落库
   *
   * 校验：
   *   - metadata.file_key 在 MinIO 中必须真实存在（防伪造 URL）
   */
  async createFromFileRef(metadata: UploadResourceDto): Promise<Resource> {
    // 校验 fileKey 真实性：MinIO 中必须存在该对象
    const { exists, size } = await this.storageService.verifyObject(metadata.file_key)
    if (!exists) {
      throw new BadRequestException('文件不存在或上传未完成，请重新上传')
    }
    if (size !== undefined && size !== Number(metadata.file_size)) {
      this.logger.warn(
        `资源文件大小不一致：DTO=${metadata.file_size}, MinIO=${size}, key=${metadata.file_key}`,
      )
    }

    return this.createResource({
      name: metadata.name,
      type: metadata.type,
      url: metadata.url,
      file_size: metadata.file_size,
      mime_type: metadata.mime_type,
      width: metadata.width,
      height: metadata.height,
      duration: metadata.duration,
      group_id: metadata.group_id,
      file_key: metadata.file_key,
    })
  }

  // ===== 分组管理 =====

  /** 获取所有分组 */
  async findAllGroups(): Promise<ResourceGroup[]> {
    return this.groupRepo.find({ order: { sort_order: 'ASC' } })
  }

  /** 创建分组 */
  async createGroup(dto: CreateResourceGroupDto): Promise<ResourceGroup> {
    const group = this.groupRepo.create(dto)
    return this.groupRepo.save(group)
  }

  /** 更新分组 */
  async updateGroup(id: string, dto: UpdateResourceGroupDto): Promise<ResourceGroup> {
    const group = await this.groupRepo.findOne({ where: { id } })
    if (!group) {
      throw new NotFoundException(`分组不存在: ${id}`)
    }
    Object.assign(group, dto)
    return this.groupRepo.save(group)
  }

  /** 删除分组（资源移至未分组） */
  async removeGroup(id: string): Promise<void> {
    const group = await this.groupRepo.findOne({ where: { id } })
    if (!group) {
      throw new NotFoundException(`分组不存在: ${id}`)
    }
    // SET NULL 外键会自动处理，但显式清除更安全
    await this.resourceRepo
      .createQueryBuilder()
      .update(Resource)
      .set({ group_id: null })
      .where('group_id = :groupId', { groupId: id })
      .execute()
    await this.groupRepo.remove(group)
  }
}
