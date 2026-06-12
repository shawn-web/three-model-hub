import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, EntityManager, In } from 'typeorm'
import { Scene } from './entities/scene.entity'
import { SceneModel } from './entities/scene-model.entity'
import { SceneImage } from './entities/scene-image.entity'
import { Model } from '../models/entities/model.entity'
import { ModelVersion } from '../models/entities/model-version.entity'
import {
  CreateSceneDto,
  UpdateSceneDto,
  AddSceneModelDto,
  UpdateSceneModelDto,
  BatchSceneModelItemDto,
  AddSceneImageDto,
  UpdateSceneImageDto,
  BatchSceneImageItemDto,
} from './dto/scene.dto'
import { SaveGeoConfigDto } from './dto/save-geo-config.dto'

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
    @InjectRepository(SceneImage)
    private sceneImageRepo: Repository<SceneImage>,
    @InjectRepository(Model)
    private modelRepo: Repository<Model>,
    @InjectRepository(ModelVersion)
    private versionRepo: Repository<ModelVersion>,
    private dataSource: DataSource,
  ) {}

  /** 获取场景列表 */
  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
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
      relations: ['scene_models', 'scene_images'],
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
        backgroundColor: '#1a1a2e',
        autoRotate: false,
      },
    })
    return this.sceneRepo.save(scene)
  }

  /** 更新场景（仅更新场景自身字段，不加载 scene_models 关联） */
  async update(id: string, dto: UpdateSceneDto): Promise<Scene> {
    const scene = await this.sceneRepo.findOne({ where: { id } })
    if (!scene) {
      throw new NotFoundException(`场景不存在: ${id}`)
    }
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
      geo_position: dto.geo_position || null,
    })
    return this.sceneModelRepo.save(sceneModel)
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
    if (dto.geo_position !== undefined) sceneModel.geo_position = dto.geo_position

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
   * 统一保存 Geo 配置
   *
   * 真原子：模型坐标批量更新 + Scene.scene_config 写入包在同一 dataSource.transaction 内。
   * 任一步抛错，整个事务回滚，避免「模型坐标已落库但底图配置丢失」的半完成状态。
   */
  async saveGeoConfig(sceneId: string, dto: SaveGeoConfigDto): Promise<void> {
    await this.findOne(sceneId)

    await this.dataSource.transaction(async (manager) => {
      // 1. 批量更新模型坐标（复用事务 manager）
      await this.batchUpdateModels(sceneId, dto.models, manager)

      // 2. 更新场景底图配置（同一事务内）
      if (dto.geoConfig) {
        const sceneRepo = manager.getRepository(Scene)
        const scene = await sceneRepo.findOne({ where: { id: sceneId } })
        if (scene) {
          const currentConfig = (scene.scene_config as Record<string, any>) || {}
          scene.scene_config = {
            ...currentConfig,
            geo: {
              ...(currentConfig.geo as Record<string, any> || {}),
              ...dto.geoConfig,
            },
          }
          await sceneRepo.save(scene)
        }
      }
    })
  }

  /**
   * 批量更新场景中的模型配置（事务 + 批量查询）
   *
   * @param manager 可选的事务 EntityManager；提供时所有写入走该事务，
   *                不提供时本方法自己包裹一个独立事务
   */
  async batchUpdateModels(
    sceneId: string,
    items: BatchSceneModelItemDto[],
    manager?: EntityManager,
  ): Promise<void> {
    if (!manager) await this.findOne(sceneId)

    if (items.length === 0) return

    const itemIds = items.map((item) => item.id)
    const repo = manager ? manager.getRepository(SceneModel) : this.sceneModelRepo
    const sceneModels = await repo
      .createQueryBuilder('sm')
      .where('sm.id IN (:...ids)', { ids: itemIds })
      .andWhere('sm.scene_id = :sceneId', { sceneId })
      .getMany()

    const modelMap = new Map(sceneModels.map((sm) => [sm.id, sm]))

    const writer = async (mgr: EntityManager) => {
      for (const item of items) {
        const sceneModel = modelMap.get(item.id)
        if (!sceneModel) continue

        if (item.transform !== undefined) sceneModel.transform = item.transform
        if (item.material_overrides !== undefined) sceneModel.material_overrides = item.material_overrides
        if (item.visible !== undefined) sceneModel.visible = item.visible
        if (item.display_name !== undefined) sceneModel.display_name = item.display_name
        if (item.geo_position !== undefined) sceneModel.geo_position = item.geo_position
      }
      // 批量保存所有模型
      // 注意：必须用 Array.from(modelMap.values())，不能 Object.values(modelMap)，
      //       后者对 Map 实例返回 []，导致 save 收到空数组（pending-issues.md pi-001）
      await mgr.save(SceneModel, Array.from(modelMap.values()))
    }

    if (manager) {
      await writer(manager)
    } else {
      await this.dataSource.transaction(writer)
    }
  }

  /**
   * 获取场景的完整数据（用于前端预览）
   * 包含所有模型信息、文件 URL 和缩略图
   */
  async getSceneData(id: string) {
    const scene = await this.findOne(id)

    // 批量获取关联模型的 file_url 和 thumbnail_url，避免前端 N+1 请求
    const modelIds = scene.scene_models.map((sm) => sm.model_id)
    const modelEntities = modelIds.length > 0
      ? await this.modelRepo.findBy({ id: In(modelIds) })
      : []
    const modelMap = new Map(modelEntities.map((m) => [m.id, m]))

    // 当 Model.file_url 为空时，回退到最新版本的 file_url
    const modelIdsWithoutFileUrl = modelEntities
      .filter((m) => !m.file_url)
      .map((m) => m.id)
    const versionMap = new Map<string, string>()
    if (modelIdsWithoutFileUrl.length > 0) {
      const versions = await this.versionRepo
        .createQueryBuilder('v')
        .select(['v.model_id', 'v.file_url', 'v.thumbnail_url'])
        .where('v.model_id IN (:...ids)', { ids: modelIdsWithoutFileUrl })
        .orderBy('v.version_number', 'DESC')
        .getMany()
      // 只取每个模型的最新版本
      for (const v of versions) {
        if (!versionMap.has(v.model_id)) {
          versionMap.set(v.model_id, v.file_url)
        }
      }
    }

    return {
      id: scene.id,
      name: scene.name,
      description: scene.description,
      config: scene.scene_config,
      markers: scene.markers || [],
      images: (scene.scene_images || []).map((si) => ({
        id: si.id,
        type: si.type,
        url: si.url,
        name: si.name,
        width: si.width,
        height: si.height,
        position: si.position,
        scale: si.scale,
        rotation: si.rotation,
        visible: si.visible,
        billboard: si.billboard,
        sort_order: si.sort_order,
        autoplay: si.autoplay,
        muted: si.muted,
        loop: si.loop,
        text: si.text,
        fontSize: si.fontSize,
        fontColor: si.fontColor,
        iframeUrl: si.iframeUrl,
      })),
      models: scene.scene_models.map((sm) => {
        const modelEntity = modelMap.get(sm.model_id)
        const fallback = versionMap.get(sm.model_id)
        const fileUrl = modelEntity?.file_url || fallback || null
        const thumbnailUrl = modelEntity?.thumbnail_url || null
        return {
          id: sm.id,
          model_id: sm.model_id,
          model_version_id: sm.model_version_id,
          transform: sm.transform,
          material_overrides: sm.material_overrides,
          visible: sm.visible,
          display_name: sm.display_name,
          sort_order: sm.sort_order,
          geo_position: sm.geo_position,
          file_url: fileUrl,
          thumbnail_url: thumbnailUrl,
        }
      }),
    }
  }

  /**
   * 添加图片到场景
   */
  async addImage(sceneId: string, dto: AddSceneImageDto): Promise<SceneImage> {
    await this.findOne(sceneId)
    const image = this.sceneImageRepo.create({
      scene_id: sceneId,
      type: dto.type || 'image',
      url: dto.url || null,
      name: dto.name,
      width: dto.width,
      height: dto.height,
      position: dto.position || null,
      scale: dto.scale || null,
      rotation: dto.rotation || null,
      visible: dto.visible !== undefined ? dto.visible : true,
      billboard: dto.billboard !== undefined ? dto.billboard : true,
      sort_order: dto.sort_order || 0,
      autoplay: dto.autoplay !== undefined ? dto.autoplay : null,
      muted: dto.muted !== undefined ? dto.muted : null,
      loop: dto.loop !== undefined ? dto.loop : null,
      text: dto.text || null,
      fontSize: dto.fontSize || null,
      fontColor: dto.fontColor || null,
      iframeUrl: dto.iframeUrl || null,
    })
    return this.sceneImageRepo.save(image)
  }

  /**
   * 更新场景中的图片
   */
  async updateImage(
    sceneId: string,
    imageId: string,
    dto: UpdateSceneImageDto,
  ): Promise<SceneImage> {
    const image = await this.sceneImageRepo.findOne({
      where: { id: imageId, scene_id: sceneId },
    })
    if (!image) {
      throw new NotFoundException('场景中的图片不存在')
    }

    if (dto.type !== undefined) image.type = dto.type
    if (dto.url !== undefined) image.url = dto.url
    if (dto.name !== undefined) image.name = dto.name
    if (dto.width !== undefined) image.width = dto.width
    if (dto.height !== undefined) image.height = dto.height
    if (dto.position !== undefined) image.position = dto.position
    if (dto.scale !== undefined) image.scale = dto.scale
    if (dto.rotation !== undefined) image.rotation = dto.rotation
    if (dto.visible !== undefined) image.visible = dto.visible
    if (dto.sort_order !== undefined) image.sort_order = dto.sort_order
    if (dto.billboard !== undefined) image.billboard = dto.billboard
    if (dto.autoplay !== undefined) image.autoplay = dto.autoplay
    if (dto.muted !== undefined) image.muted = dto.muted
    if (dto.loop !== undefined) image.loop = dto.loop
    if (dto.text !== undefined) image.text = dto.text
    if (dto.fontSize !== undefined) image.fontSize = dto.fontSize
    if (dto.fontColor !== undefined) image.fontColor = dto.fontColor
    if (dto.iframeUrl !== undefined) image.iframeUrl = dto.iframeUrl

    return this.sceneImageRepo.save(image)
  }

  /**
   * 从场景中移除图片
   */
  async removeImage(sceneId: string, imageId: string): Promise<void> {
    const image = await this.sceneImageRepo.findOne({
      where: { id: imageId, scene_id: sceneId },
    })
    if (!image) {
      throw new NotFoundException('场景中的图片不存在')
    }
    await this.sceneImageRepo.remove(image)
  }

  /**
   * 批量保存场景图片（事务：先删除再重建）
   */
  async batchSaveImages(sceneId: string, items: BatchSceneImageItemDto[]): Promise<void> {
    await this.findOne(sceneId)

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(SceneImage, { scene_id: sceneId })

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const image = manager.create(SceneImage, {
          scene_id: sceneId,
          type: item.type || 'image',
          url: item.url || null,
          name: item.name,
          width: item.width,
          height: item.height,
          position: item.position || null,
          scale: item.scale || null,
          rotation: item.rotation || null,
          visible: item.visible !== undefined ? item.visible : true,
          billboard: item.billboard !== undefined ? item.billboard : true,
          sort_order: item.sort_order ?? i,
          autoplay: item.autoplay !== undefined ? item.autoplay : null,
          muted: item.muted !== undefined ? item.muted : null,
          loop: item.loop !== undefined ? item.loop : null,
          text: item.text || null,
          fontSize: item.fontSize || null,
          fontColor: item.fontColor || null,
          iframeUrl: item.iframeUrl || null,
        })
        await manager.save(SceneImage, image)
      }
    })
  }
}


