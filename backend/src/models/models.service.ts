import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { Model } from './entities/model.entity'
import { ModelVersion } from './entities/model-version.entity'
import { SceneModel } from '../scenes/entities/scene-model.entity'
import { Scene } from '../scenes/entities/scene.entity'
import { StorageService } from '../storage/storage.service'
import { ModelCompressionService } from './model-compression.service'
import { UpdateModelDto, CreateFromUrlDto, CreateVersionFromUrlDto } from './dto/model.dto'

/**
 * 模型管理服务
 * 处理模型的增删改查、版本管理、文件上传等业务逻辑
 *
 * 存储层：tapp → MinIO 重构
 *   - 旧 tapp 代理上传已删除，所有上传走 storageService（内部 MinIO）
 *   - proxyFile 改为返回 MinIO 公开 URL（前端直接 fetch，bucket 匿名 download）
 *   - 旧 tapp 数据（file_key 为 null）返回 NotFound
 */
@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name)

  constructor(
    @InjectRepository(Model)
    private modelRepo: Repository<Model>,
    @InjectRepository(ModelVersion)
    private versionRepo: Repository<ModelVersion>,
    @InjectRepository(SceneModel)
    private sceneModelRepo: Repository<SceneModel>,
    private storageService: StorageService,
    private compressionService: ModelCompressionService,
    private dataSource: DataSource,
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

  /**
   * 前端分片上传完成后创建模型
   * 流程：前端先调 /upload/multipart/* 完成上传，再调此接口落库
   *
   * 校验：
   *   - dto.file_key 在 MinIO 中必须真实存在（防伪造 URL）
   */
  async createFromUrl(
    dto: CreateFromUrlDto,
  ): Promise<{ model: Model; compressionTaskId?: string }> {
    // 校验 fileKey 真实性：MinIO 中必须存在该对象
    const { exists, size } = await this.storageService.verifyObject(dto.file_key)
    if (!exists) {
      throw new BadRequestException('文件不存在或上传未完成，请重新上传')
    }
    // 文件大小校验（防前端伪造 file_size）
    if (size !== undefined && size !== Number(dto.file_size)) {
      this.logger.warn(
        `文件大小不一致：DTO=${dto.file_size}, MinIO=${size}, key=${dto.file_key}`,
      )
    }

    const fileFormat = this.storageService.detectFormat(dto.file_name)

    // 事务：落库 model + version
    const savedModel = await this.dataSource.transaction(async (manager) => {
      const model = manager.create(Model, {
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
      const saved = await manager.save(Model, model)

      const version = manager.create(ModelVersion, {
        model_id: saved.id,
        version_number: 1,
        file_url: dto.file_url,
        file_size: dto.file_size,
        file_key: dto.file_key,
        commit_message: dto.commit_message || '初始版本',
      })
      await manager.save(ModelVersion, version)

      return saved
    })

    // 事务提交后再触发压缩（startCompression 用非事务 Repository 查询，
    // 事务内未提交的数据对其他连接不可见，会导致 NotFoundException）
    // 注：压缩本身是异步 best-effort，触发失败不应阻塞已落库的 model，
    // 仅 warn 日志 + 不返回 compressionTaskId（前端可手动触发压缩）
    let compressionTaskId: string | undefined
    if (dto.compress) {
      try {
        compressionTaskId = (await this.compressionService.startCompression(savedModel.id, undefined)).taskId
      } catch (e: any) {
        this.logger.warn(`上传后触发压缩失败（model 已落库）: ${e?.message || e}`)
      }
    }

    return { model: savedModel, compressionTaskId }
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
   * 前端分片上传完成后创建版本
   * 流程：前端先调 /upload/multipart/* 完成上传，再调此接口落库
   *
   * 校验：
   *   - dto.file_key 在 MinIO 中必须真实存在（防伪造 URL）
   */
  async createVersionFromUrl(
    modelId: string,
    dto: CreateVersionFromUrlDto,
  ): Promise<{ version: ModelVersion; compressionTaskId?: string }> {
    // 校验 fileKey 真实性
    const { exists, size } = await this.storageService.verifyObject(dto.file_key)
    if (!exists) {
      throw new BadRequestException('文件不存在或上传未完成，请重新上传')
    }
    if (size !== undefined && size !== Number(dto.file_size)) {
      this.logger.warn(
        `版本文件大小不一致：DTO=${dto.file_size}, MinIO=${size}, key=${dto.file_key}`,
      )
    }

    // 事务：落库 version + 更新 model
    const fileFormat = this.storageService.detectFormat(dto.file_name)
    const savedVersion = await this.dataSource.transaction(async (manager) => {
      // 对 model 行加写锁，防止并发读改写导致 version_number 重复
      const model = await manager.findOne(Model, {
        where: { id: modelId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!model) {
        throw new NotFoundException(`模型不存在: ${modelId}`)
      }

      // 版本号自增
      const newVersionNumber = model.version_count + 1

      const version = manager.create(ModelVersion, {
        model_id: modelId,
        version_number: newVersionNumber,
        file_url: dto.file_url,
        file_size: dto.file_size,
        file_key: dto.file_key,
        commit_message: dto.commit_message || `版本 ${newVersionNumber}`,
      })
      const saved = await manager.save(ModelVersion, version)

      // 更新模型的版本计数和文件引用
      model.version_count = newVersionNumber
      model.file_url = dto.file_url
      model.file_size = dto.file_size
      model.file_name = dto.file_name
      model.file_key = dto.file_key
      model.file_format = fileFormat
      await manager.save(Model, model)

      return saved
    })

    // 事务提交后再触发压缩（startCompression 用非事务 Repository 查询，
    // 事务内未提交的数据对其他连接不可见，会导致 NotFoundException）
    // 注：压缩本身是异步 best-effort，触发失败不应阻塞已落库的 version，
    // 仅 warn 日志 + 不返回 compressionTaskId（前端可手动触发压缩）
    let compressionTaskId: string | undefined
    if (dto.compress) {
      try {
        compressionTaskId = (await this.compressionService.startCompression(modelId, undefined)).taskId
      } catch (e: any) {
        this.logger.warn(`上传新版本后触发压缩失败（version 已落库）: ${e?.message || e}`)
      }
    }

    return { version: savedVersion, compressionTaskId }
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
   * 复制模型（复用 fileKey，MinIO 端不复制文件）
   */
  async copy(id: string): Promise<Model> {
    const original = await this.findOne(id)

    return this.dataSource.transaction(async (manager) => {
      // 对原模型行加写锁，防止并发读改写导致版本号/计数异常
      await manager.findOne(Model, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      })

      const copy = manager.create(Model, {
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
      const savedCopy = await manager.save(Model, copy)

      // 复制最新版本
      const latestVersion = await manager.findOne(ModelVersion, {
        where: { model_id: id },
        order: { version_number: 'DESC' },
      })
      if (latestVersion) {
        const versionCopy = manager.create(ModelVersion, {
          model_id: savedCopy.id,
          version_number: 1,
          file_url: latestVersion.file_url,
          file_size: latestVersion.file_size,
          file_hash: latestVersion.file_hash,
          file_key: latestVersion.file_key,
          commit_message: `复制自 ${original.name}`,
        })
        await manager.save(ModelVersion, versionCopy)
      }

      return savedCopy
    })
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

  /**
   * 获取模型文件的可访问 URL（重定向）
   *
   * 重构说明：
   *   - 旧实现：axios.get(tappURL) 流式转发，绕过 CORS
   *   - 新实现：直接返回 MinIO 公开 URL（bucket 匿名 download），前端 fetch
   *
   * 老 tapp 数据兼容：
   *   - 若 file_key 缺失（老数据），直接返回原 file_url（仍可访问直到 tapp 服务下线）
   *   - 用户决策：失败就失败，提示即可，不做兜底兼容
   */
  async getFileRedirectUrl(id: string): Promise<string> {
    const model = await this.modelRepo.findOne({ where: { id } })
    if (!model) {
      throw new NotFoundException(`模型不存在: ${id}`)
    }
    if (!model.file_url) {
      throw new NotFoundException(`模型文件不存在: ${id}`)
    }
    // 老 tapp 数据：file_key 为 null（之前 tapp 时代不上传 file_key）
    if (!model.file_key) {
      this.logger.warn(`模型 ${id} 缺少 file_key（疑似 tapp 旧数据），返回 404`)
      throw new NotFoundException(`文件已失效，请重新上传该模型`)
    }
    return this.storageService.getPublicUrl(model.file_key)
  }
}
