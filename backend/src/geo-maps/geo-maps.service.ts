import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, EntityManager, In } from 'typeorm'
import { GeoMap } from './entities/geo-map.entity'
import { GeoMapModel } from './entities/geo-map-model.entity'
import { Model } from '../models/entities/model.entity'
import {
  CreateGeoMapDto,
  UpdateGeoMapDto,
  AddGeoMapModelDto,
  UpdateGeoMapModelDto,
  BatchGeoMapModelItemDto,
  SaveGeoMapConfigDto,
} from './dto/geo-map.dto'

/**
 * 地理地图管理服务
 * 处理地图和地图-模型关联的增删改查
 */
@Injectable()
export class GeoMapsService {
  constructor(
    @InjectRepository(GeoMap)
    private geoMapRepo: Repository<GeoMap>,
    @InjectRepository(GeoMapModel)
    private geoMapModelRepo: Repository<GeoMapModel>,
    @InjectRepository(Model)
    private modelRepo: Repository<Model>,
    private dataSource: DataSource,
  ) {}

  /** 获取地图列表 */
  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const qb = this.geoMapRepo.createQueryBuilder('geo_map')

    if (query.search) {
      qb.where('geo_map.name LIKE :search', { search: `%${query.search}%` })
    }

    qb.orderBy('geo_map.updated_at', 'DESC')
      .skip(offset)
      .take(limit)

    const [items, total] = await qb.getManyAndCount()
    return { items, total, page, limit }
  }

  /** 获取地图详情（含关联模型） */
  async findOne(id: string): Promise<GeoMap> {
    const geoMap = await this.geoMapRepo.findOne({
      where: { id },
      relations: ['geo_map_models'],
    })
    if (!geoMap) {
      throw new NotFoundException(`地图不存在: ${id}`)
    }
    return geoMap
  }

  /** 创建地图 */
  async create(dto: CreateGeoMapDto): Promise<GeoMap> {
    const geoMap = this.geoMapRepo.create({
      name: dto.name,
      description: dto.description,
      config: dto.config || {},
    })
    return this.geoMapRepo.save(geoMap)
  }

  /** 更新地图 */
  async update(id: string, dto: UpdateGeoMapDto): Promise<GeoMap> {
    const geoMap = await this.geoMapRepo.findOne({ where: { id } })
    if (!geoMap) {
      throw new NotFoundException(`地图不存在: ${id}`)
    }
    Object.assign(geoMap, dto)
    return this.geoMapRepo.save(geoMap)
  }

  /** 删除地图 */
  async remove(id: string): Promise<void> {
    const geoMap = await this.findOne(id)
    await this.geoMapRepo.remove(geoMap)
  }

  /** 添加模型到地图 */
  async addModel(geoMapId: string, dto: AddGeoMapModelDto): Promise<GeoMapModel> {
    await this.findOne(geoMapId)

    const geoMapModel = this.geoMapModelRepo.create({
      geo_map_id: geoMapId,
      model_id: dto.model_id,
      model_version_id: dto.model_version_id || null,
      display_name: dto.display_name || null,
      geo_position: dto.geo_position ? (dto.geo_position as unknown as Record<string, unknown>) : null,
      visible: dto.visible !== undefined ? dto.visible : true,
      sort_order: dto.sort_order || 0,
    })
    return this.geoMapModelRepo.save(geoMapModel)
  }

  /** 更新地图中的模型 */
  async updateModel(
    geoMapId: string,
    modelId: string,
    dto: UpdateGeoMapModelDto,
  ): Promise<GeoMapModel> {
    await this.findOne(geoMapId)

    const geoMapModel = await this.geoMapModelRepo.findOne({
      where: { id: modelId, geo_map_id: geoMapId },
    })
    if (!geoMapModel) {
      throw new NotFoundException(`地图模型不存在: ${modelId}`)
    }
    Object.assign(geoMapModel, dto)
    return this.geoMapModelRepo.save(geoMapModel)
  }

  /** 从地图中移除模型 */
  async removeModel(geoMapId: string, modelId: string): Promise<void> {
    await this.findOne(geoMapId)

    const geoMapModel = await this.geoMapModelRepo.findOne({
      where: { id: modelId, geo_map_id: geoMapId },
    })
    if (!geoMapModel) {
      throw new NotFoundException(`地图模型不存在: ${modelId}`)
    }
    await this.geoMapModelRepo.remove(geoMapModel)
  }

  /** 批量更新地图中的模型配置（批量查询 + 批量保存）
   *
   * @param manager 可选的事务 EntityManager；提供时所有写入走该事务，
   *                不提供时本方法自己包裹一个独立事务
   */
  async batchUpdateModels(
    geoMapId: string,
    items: BatchGeoMapModelItemDto[],
    manager?: EntityManager,
  ): Promise<void> {
    if (!manager) await this.findOne(geoMapId)

    if (items.length === 0) return

    const repo = manager ? manager.getRepository(GeoMapModel) : this.geoMapModelRepo
    const itemIds = items.map((item) => item.id)
    const geoMapModels = await repo
      .createQueryBuilder('gmm')
      .where('gmm.id IN (:...ids)', { ids: itemIds })
      .andWhere('gmm.geo_map_id = :geoMapId', { geoMapId })
      .getMany()

    const modelMap = new Map(geoMapModels.map((gmm) => [gmm.id, gmm]))

    const writer = async (mgr: EntityManager) => {
      for (const item of items) {
        const geoMapModel = modelMap.get(item.id)
        if (!geoMapModel) continue
        if (item.display_name !== undefined) geoMapModel.display_name = item.display_name
        if (item.geo_position !== undefined) geoMapModel.geo_position = item.geo_position as unknown as Record<string, unknown>
        if (item.visible !== undefined) geoMapModel.visible = item.visible
      }
      await mgr.save(GeoMapModel, Array.from(modelMap.values()))
    }

    if (manager) {
      await writer(manager)
    } else {
      await this.dataSource.transaction(writer)
    }
  }

  /**
   * 统一保存 Geo 配置
   *
   * 真原子：模型坐标批量更新 + GeoMap.config 写入包在同一 dataSource.transaction 内。
   * 任一步抛错，整个事务回滚，避免「模型坐标已落库但底图配置丢失」的半完成状态。
   */
  async saveGeoConfig(geoMapId: string, dto: SaveGeoMapConfigDto): Promise<void> {
    await this.findOne(geoMapId)

    await this.dataSource.transaction(async (manager) => {
      // 1. 批量更新模型坐标（复用事务 manager）
      await this.batchUpdateModels(geoMapId, dto.models, manager)

      // 2. 更新地图底图配置（同一事务内）
      if (dto.geoConfig) {
        const geoMapRepo = manager.getRepository(GeoMap)
        const geoMap = await geoMapRepo.findOne({ where: { id: geoMapId } })
        if (geoMap) {
          const currentConfig = (geoMap.config as Record<string, any>) || {}
          geoMap.config = {
            ...currentConfig,
            geo: {
              ...((currentConfig.geo as Record<string, any>) || {}),
              ...dto.geoConfig,
            },
          }
          await geoMapRepo.save(geoMap)
        }
      }
    })
  }

  /**
   * 获取地图完整数据（用于前端渲染）
   * 包含地图自身信息 + 关联模型列表（JOIN models 表获取 file_url/thumbnail_url）
   */
  async getMapData(id: string) {
    const geoMap = await this.geoMapRepo.findOne({
      where: { id },
      relations: ['geo_map_models'],
    })
    if (!geoMap) {
      throw new NotFoundException(`地图不存在: ${id}`)
    }

    // 收集所有 model_id
    const modelIds = geoMap.geo_map_models.map((m) => m.model_id)

    // 批量查询模型信息（避免 N+1）
    const models = modelIds.length > 0
      ? await this.modelRepo.findBy({ id: In(modelIds) })
      : []

    const modelMap = new Map(models.map((m) => [m.id, m]))

    return {
      id: geoMap.id,
      name: geoMap.name,
      description: geoMap.description,
      thumbnail_url: geoMap.thumbnail_url,
      config: geoMap.config,
      created_at: geoMap.created_at,
      updated_at: geoMap.updated_at,
      models: geoMap.geo_map_models.map((gmm) => {
        const model = modelMap.get(gmm.model_id)
        return {
          id: gmm.id,
          model_id: gmm.model_id,
          display_name: gmm.display_name,
          geo_position: gmm.geo_position,
          visible: gmm.visible,
          sort_order: gmm.sort_order,
          file_url: model?.file_url || null,
          thumbnail_url: model?.thumbnail_url || null,
          model_name: model?.name || null,
        }
      }),
    }
  }
}
