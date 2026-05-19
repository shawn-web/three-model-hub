import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Scene } from './entities/scene.entity'
import { SceneModel } from './entities/scene-model.entity'
import {
  CreateSceneDto,
  UpdateSceneDto,
  AddSceneModelDto,
  UpdateSceneModelDto,
  BatchSceneModelItemDto,
} from './dto/scene.dto'

/**
 * 场景管理服务
 * 处理场景和场景-模型关联的增删改查
 */
@Injectable()
export class ScenesService {
  constructor(
    @InjectRepository(Scene)
    private sceneRepo: Repository<Scene>,
    @InjectRepository(SceneModel)
    private sceneModelRepo: Repository<SceneModel>,
  ) {}

  /** 获取场景列表 */
  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = query.page || 1
    const limit = Math.min(query.limit || 20, 100)
    const offset = (page - 1) * limit

    const qb = this.sceneRepo.createQueryBuilder('scene')

    if (query.search) {
      qb.where('scene.name LIKE :search', { search: `%${query.search}%` })
    }

    qb.orderBy('scene.updated_at', 'DESC')
      .skip(offset)
      .take(limit)

    const [items, total] = await qb.getManyAndCount()
    return { items, total, page, limit }
  }

  /** 获取场景详情（含所有关联模型） */
  async findOne(id: string): Promise<Scene> {
    const scene = await this.sceneRepo.findOne({
      where: { id },
      relations: ['scene_models'],
    })
    if (!scene) {
      throw new NotFoundException(`场景不存在: ${id}`)
    }
    return scene
  }

  /** 创建场景 */
  async create(dto: CreateSceneDto): Promise<Scene> {
    const scene = this.sceneRepo.create({
      name: dto.name,
      description: dto.description,
      scene_config: dto.scene_config || {
        camera: { position: [5, 5, 5], target: [0, 0, 0] },
        backgroundColor: '#1a1a2e',
        autoRotate: false,
      },
    })
    return this.sceneRepo.save(scene)
  }

  /** 更新场景 */
  async update(id: string, dto: UpdateSceneDto): Promise<Scene> {
    const scene = await this.findOne(id)
    Object.assign(scene, dto)
    return this.sceneRepo.save(scene)
  }

  /** 删除场景 */
  async remove(id: string): Promise<void> {
    const scene = await this.findOne(id)
    await this.sceneRepo.remove(scene)
  }

  /**
   * 添加模型到场景
   */
  async addModel(sceneId: string, dto: AddSceneModelDto): Promise<SceneModel> {
    await this.findOne(sceneId)

    const sceneModel = this.sceneModelRepo.create({
      scene_id: sceneId,
      model_id: dto.model_id,
      model_version_id: dto.model_version_id || null,
      transform: dto.transform || {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      material_overrides: dto.material_overrides || null,
      visible: dto.visible !== undefined ? dto.visible : true,
      sort_order: dto.sort_order || 0,
      display_name: dto.display_name || null,
    } as any)
    return this.sceneModelRepo.save(sceneModel as any) as any
  }

  /**
   * 更新场景中的模型配置
   */
  async updateModel(
    sceneId: string,
    sceneModelId: string,
    dto: UpdateSceneModelDto,
  ): Promise<SceneModel> {
    const sceneModel = await this.sceneModelRepo.findOne({
      where: { id: sceneModelId, scene_id: sceneId },
    })
    if (!sceneModel) {
      throw new NotFoundException('场景中的模型不存在')
    }

    if (dto.transform !== undefined) sceneModel.transform = dto.transform
    if (dto.material_overrides !== undefined) sceneModel.material_overrides = dto.material_overrides
    if (dto.visible !== undefined) sceneModel.visible = dto.visible
    if (dto.sort_order !== undefined) sceneModel.sort_order = dto.sort_order
    if (dto.display_name !== undefined) sceneModel.display_name = dto.display_name

    return this.sceneModelRepo.save(sceneModel)
  }

  /**
   * 从场景中移除模型
   */
  async removeModel(sceneId: string, sceneModelId: string): Promise<void> {
    const sceneModel = await this.sceneModelRepo.findOne({
      where: { id: sceneModelId, scene_id: sceneId },
    })
    if (!sceneModel) {
      throw new NotFoundException('场景中的模型不存在')
    }
    await this.sceneModelRepo.remove(sceneModel)
  }

  /**
   * 批量更新场景中的模型配置
   */
  async batchUpdateModels(sceneId: string, items: BatchSceneModelItemDto[]): Promise<void> {
    await this.findOne(sceneId)

    for (const item of items) {
      const sceneModel = await this.sceneModelRepo.findOne({
        where: { id: item.id, scene_id: sceneId },
      })
      if (!sceneModel) continue

      if (item.transform !== undefined) sceneModel.transform = item.transform
      if (item.material_overrides !== undefined) sceneModel.material_overrides = item.material_overrides
      if (item.visible !== undefined) sceneModel.visible = item.visible
      if (item.display_name !== undefined) sceneModel.display_name = item.display_name

      await this.sceneModelRepo.save(sceneModel)
    }
  }

  /**
   * 获取场景的完整数据（用于前端预览）
   * 包含所有模型信息和文件 URL
   */
  async getSceneData(id: string) {
    const scene = await this.findOne(id)
    return {
      id: scene.id,
      name: scene.name,
      description: scene.description,
      config: scene.scene_config,
      models: scene.scene_models.map((sm) => ({
        id: sm.id,
        model_id: sm.model_id,
        model_version_id: sm.model_version_id,
        transform: sm.transform,
        material_overrides: sm.material_overrides,
        visible: sm.visible,
        display_name: sm.display_name,
        sort_order: sm.sort_order,
      })),
    }
  }
}
