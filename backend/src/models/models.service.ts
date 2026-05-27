import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Model } from './entities/model.entity'
import { ModelVersion } from './entities/model-version.entity'
import { SceneModel } from '../scenes/entities/scene-model.entity'
import { Scene } from '../scenes/entities/scene.entity'
import { StorageService } from '../storage/storage.service'
import { MulterFile } from '../common/types'
import { CreateModelDto, UpdateModelDto, CreateFromUrlDto } from './dto/model.dto'

/**
 * 模型管理服务
 * 处理模型的增删改查、版本管理、文件上传等业务逻辑
 */
@Injectable()
export class ModelsService {
  constructor(
    @InjectRepository(Model)
    private modelRepo: Repository<Model>,
    @InjectRepository(ModelVersion)
    private versionRepo: Repository<ModelVersion>,
    @InjectRepository(SceneModel)
    private sceneModelRepo: Repository<SceneModel>,
    private storageService: StorageService,
  ) {}

  /**
   * 获取模型列表
   * 支持分页、搜索和标签筛选
   */
  async findAll(query: {
    page?: number
    limit?: number
    search?: string
    tag?: string
  }) {
    const page = Math.max(query.page || 1, 1)
    const limit = Math.min(Math.max(query.limit || 20, 1), 100)
    const offset = (page - 1) * limit

    const qb = this.modelRepo.createQueryBuilder('model')

    if (query.search) {
      qb.where('model.name LIKE :search', { search: `%${query.search}%` })
        .orWhere('model.description LIKE :search', { search: `%${query.search}%` })
    }

    if (query.tag) {
      qb.andWhere('JSON_CONTAINS(model.tags, :tag)', { tag: JSON.stringify(query.tag) })
    }

    qb.orderBy('model.updated_at', 'DESC')
      .skip(offset)
      .take(limit)

    const [items, total] = await qb.getManyAndCount()
    return { items, total, page, limit }
  }

  /**
   * 获取模型详情
   */
  async findOne(id: string): Promise<Model> {
    const model = await this.modelRepo.findOne({
      where: { id },
      relations: ['versions'],
    })
    if (!model) {
      throw new NotFoundException(`模型不存在: ${id}`)
    }
    return model
  }

  /** 获取文件上传配置（供前端直传） */
  getUploadConfig() {
    return this.storageService.getUploadConfig()
  }

  /**
   * 前端直传后创建模型
   * 前端已直接上传到文件服务，此方法仅创建数据库记录
   */
  async createFromUrl(dto: CreateFromUrlDto): Promise<Model> {
    const fileFormat = this.storageService.detectFormat(dto.file_name)

    const model = this.modelRepo.create({
      name: dto.name || dto.file_name.replace(/\.[^.]+$/, ''),
      description: dto.description,
      tags: dto.tags || [],
      file_url: dto.file_url,
      file_name: dto.file_name,
      file_size: dto.file_size,
      file_format: fileFormat,
      file_key: dto.file_key,
      version_count: 1,
    })
    const savedModel = await this.modelRepo.save(model)

    const version = this.versionRepo.create({
      model_id: savedModel.id,
      version_number: 1,
      file_url: dto.file_url,
      file_size: dto.file_size,
      file_key: dto.file_key,
      commit_message: dto.commit_message || '初始版本',
    })
    await this.versionRepo.save(version)

    return savedModel
  }

  /**
   * 上传新模型
   * 将文件转发到文件服务，并在数据库中创建记录
   */
  async create(
    file: MulterFile,
    dto: CreateModelDto,
  ): Promise<Model> {
    const uploadResult = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
    )

    const fileHash = this.storageService.calculateHash(file.buffer)
    const fileFormat = this.storageService.detectFormat(file.originalname)

    const model = this.modelRepo.create({
      name: dto.name || file.originalname.replace(/\.[^.]+$/, ''),
      description: dto.description,
      tags: dto.tags || [],
      file_url: uploadResult.url,
      file_name: file.originalname,
      file_size: file.size,
      file_format: fileFormat,
      file_key: uploadResult.fileKey,
      version_count: 1,
    })
    const savedModel = await this.modelRepo.save(model)

    const version = this.versionRepo.create({
      model_id: savedModel.id,
      version_number: 1,
      file_url: uploadResult.url,
      file_size: file.size,
      file_hash: fileHash,
      file_key: uploadResult.fileKey,
      commit_message: dto.commit_message || '初始版本',
    })
    await this.versionRepo.save(version)

    return savedModel
  }

  /**
   * 更新模型信息（不涉及文件）
   */
  async update(id: string, dto: UpdateModelDto): Promise<Model> {
    const model = await this.findOne(id)
    Object.assign(model, dto)
    return this.modelRepo.save(model)
  }

  /**
   * 删除模型及其所有版本，同时删除远程文件
   * 若模型被场景引用则拒绝删除
   */
  async remove(id: string): Promise<void> {
    const model = await this.findOne(id)

    // 检查是否有场景引用该模型
    const boundScenes = await this.getBoundScenes(id)
    if (boundScenes.length > 0) {
      const names = boundScenes.map((s) => s.sceneName).join('、')
      throw new BadRequestException(
        `该模型已被以下场景使用：${names}，请先从场景中移除该模型或删除相关场景`,
      )
    }

    // 收集所有需要删除的文件（去重）
    const filesToDelete = new Set<string>()
    if (model.file_key) {
      filesToDelete.add(model.file_key)
    }
    if (model.versions) {
      for (const version of model.versions) {
        if (version.file_key) {
          filesToDelete.add(version.file_key)
        }
      }
    }

    // 先删除远程文件，全部成功后再删除本地数据
    for (const fileName of filesToDelete) {
      try {
        await this.storageService.deleteFile(fileName)
      } catch {
        // 远程文件删除失败不影响记录删除
      }
    }

    await this.modelRepo.remove(model)
  }

  /** 查询使用了指定模型的场景列表 */
  private async getBoundScenes(modelId: string): Promise<{ sceneId: string; sceneName: string }[]> {
    const rows = await this.sceneModelRepo
      .createQueryBuilder('sm')
      .select('sm.scene_id', 'sceneId')
      .innerJoin(Scene, 's', 's.id = sm.scene_id')
      .addSelect('s.name', 'sceneName')
      .where('sm.model_id = :modelId', { modelId })
      .getRawMany()
    return rows
  }

  /**
   * 上传新版本
   */
  async uploadVersion(
    modelId: string,
    file: MulterFile,
    commitMessage?: string,
  ): Promise<ModelVersion> {
    const model = await this.findOne(modelId)

    // 上传文件
    const uploadResult = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      modelId,
    )

    const fileHash = this.storageService.calculateHash(file.buffer)

    // 版本号自增
    const newVersionNumber = model.version_count + 1

    const version = this.versionRepo.create({
      model_id: modelId,
      version_number: newVersionNumber,
      file_url: uploadResult.url,
      file_size: file.size,
      file_hash: fileHash,
      file_key: uploadResult.fileKey,
      commit_message: commitMessage || `版本 ${newVersionNumber}`,
    })
    const savedVersion = await this.versionRepo.save(version)

    // 更新模型的版本计数和文件引用
    model.version_count = newVersionNumber
    model.file_url = uploadResult.url
    model.file_size = file.size
    model.file_name = file.originalname
    model.file_key = uploadResult.fileKey
    await this.modelRepo.save(model)

    return savedVersion
  }

  /**
   * 获取模型的版本列表
   */
  async getVersions(modelId: string): Promise<ModelVersion[]> {
    return this.versionRepo.find({
      where: { model_id: modelId },
      order: { version_number: 'DESC' },
    })
  }

  /**
   * 复制模型
   */
  async copy(id: string): Promise<Model> {
    const original = await this.findOne(id)

    const copy = this.modelRepo.create({
      name: `${original.name} (副本)`,
      description: original.description,
      tags: original.tags,
      file_url: original.file_url,
      file_name: original.file_name,
      file_size: original.file_size,
      file_format: original.file_format,
      thumbnail_url: original.thumbnail_url,
      file_key: original.file_key,
      version_count: 1,
    })
    const savedCopy = await this.modelRepo.save(copy)

    // 复制最新版本
    const latestVersion = await this.versionRepo.findOne({
      where: { model_id: id },
      order: { version_number: 'DESC' },
    })
    if (latestVersion) {
      const versionCopy = this.versionRepo.create({
        model_id: savedCopy.id,
        version_number: 1,
        file_url: latestVersion.file_url,
        file_size: latestVersion.file_size,
        file_hash: latestVersion.file_hash,
        file_key: latestVersion.file_key,
        commit_message: `复制自 ${original.name}`,
      })
      await this.versionRepo.save(versionCopy)
    }

    return savedCopy
  }

  /**
   * 对比两个版本
   * 返回元数据差异
   */
  async compareVersions(
    modelId: string,
    v1: string,
    v2: string,
  ): Promise<{ version1: ModelVersion; version2: ModelVersion; diff: Record<string, any> }> {
    const version1 = await this.versionRepo.findOne({ where: { id: v1, model_id: modelId } })
    const version2 = await this.versionRepo.findOne({ where: { id: v2, model_id: modelId } })

    if (!version1 || !version2) {
      throw new NotFoundException('版本不存在')
    }

    // 基本元数据对比
    const diff = {
      file_size_diff: (version2.file_size || 0) - (version1.file_size || 0),
      version_diff: version2.version_number - version1.version_number,
      time_diff: version2.created_at.getTime() - version1.created_at.getTime(),
      metadata_diff: this.diffMetadata(version1.metadata, version2.metadata),
    }

    return { version1, version2, diff }
  }

  /** 对比两个版本的元数据 */
  private diffMetadata(m1: Record<string, any>, m2: Record<string, any>): Record<string, any> {
    if (!m1 && !m2) return {}
    const result: Record<string, any> = {}
    const allKeys = new Set([...Object.keys(m1 || {}), ...Object.keys(m2 || {})])
    for (const key of allKeys) {
      const val1 = m1?.[key]
      const val2 = m2?.[key]
      if (val1 !== val2) {
        result[key] = { from: val1, to: val2 }
      }
    }
    return result
  }

  /** 增加下载计数 */
  async incrementDownloadCount(id: string): Promise<void> {
    await this.modelRepo.increment({ id }, 'download_count', 1)
  }
}
