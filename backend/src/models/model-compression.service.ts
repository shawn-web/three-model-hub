import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { randomUUID } from 'crypto'
import { NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions'
import { dedup, weld, prune, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import { ModelVersion } from './entities/model-version.entity'
import { Model } from './entities/model.entity'
import { MinioService } from '../minio/minio.service'

/** 任务状态 */
export type CompressionStatus =
  | 'queued'
  | 'downloading'
  | 'compressing'
  | 'uploading'
  | 'completed'
  | 'failed'

/** 任务阶段（用于细化日志和前端展示） */
export type CompressionStage =
  | '准备 Meshopt 编码器'
  | '下载源文件'
  | '解析 glTF'
  | '顶点去重焊接'
  | '纹理转 WebP'
  | '几何 Meshopt 压缩'
  | '导出 GLB'
  | '回传上传'
  | '落库'

/** 任务快照 */
export interface CompressionTask {
  taskId: string
  modelId: string
  versionId: string
  algorithm: 'meshopt'
  compressTexture: boolean
  status: CompressionStatus
  stage: CompressionStage | null
  percentage: number
  originalSize?: number
  compressedSize?: number
  compressionRatio?: number
  newVersionId?: string
  errorMessage?: string
  createdAt: number
  updatedAt: number
}

/** 压缩选项（接口保留，可后续扩展） */
export interface CompressionOptions {
  /** 压缩算法：当前仅支持 meshopt */
  algorithm?: 'meshopt'
  /** 是否同时压缩纹理（转 WebP，默认 true） */
  compressTexture?: boolean
}

/** 触发压缩后端点返回 */
export interface CompressionResult {
  taskId: string
}

/**
 * 模型压缩服务
 *
 * 核心流程：
 *   1. 从 MinIO 下载源 GLB 到临时文件
 *   2. @gltf-transform/core 读取 + 数据优化（dedup / weld / prune）
 *   3. 启用 EXT_meshopt_compression 扩展，写出时自动进行 meshopt 几何压缩
 *      （浏览器原生支持 EXT_meshopt_compression；three.js 用 MeshoptDecoder，
 *       Drei 通过 <MeshoptDecoder /> 一行启用）
 *   4. 纹理可选转 WebP（sharp），启用 EXT_texture_webp 扩展
 *   5. 写出新的 GLB，上传到 MinIO 作为新 objectKey
 *   6. 写入新 ModelVersion（保留原版，commit_message 标注压缩来源）
 *
 * 任务状态：in-memory Map 维护，进程重启后丢失（用户重新触发即可）
 */
@Injectable()
export class ModelCompressionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModelCompressionService.name)
  /** taskId → task（仅 in-memory；进程重启清空，用户重新触发即可） */
  private readonly tasks = new Map<string, CompressionTask>()
  /** Meshopt WASM 初始化状态 */
  private meshoptReady = false
  /** TTL 清理定时器 */
  private cleanupTimer: NodeJS.Timeout | null = null
  /** 终态任务保留时长 */
  private static readonly TASK_TTL_MS = 60 * 60 * 1000
  /** 后台清理间隔 */
  private static readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000

  constructor(
    @InjectRepository(Model) private readonly modelRepo: Repository<Model>,
    @InjectRepository(ModelVersion) private readonly versionRepo: Repository<ModelVersion>,
    private readonly minioService: MinioService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 启动时一次等 Meshopt WASM 初始化 + 启动 TTL 清理
   * 初始化失败抛错启动失败（压缩是核心功能，不带病运行）
   */
  async onModuleInit(): Promise<void> {
    try {
      await MeshoptEncoder.ready
      await MeshoptDecoder.ready
      this.meshoptReady = true
      this.logger.log('Meshopt encoder/decoder WASM 已就绪')
    } catch (e: any) {
      this.logger.error(`Meshopt WASM 初始化失败：${e?.message || e}`)
      throw new InternalServerErrorException(
        '模型压缩依赖的 Meshopt WASM 初始化失败，请检查 meshoptimizer 包安装',
      )
    }
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredTasks(),
      ModelCompressionService.CLEANUP_INTERVAL_MS,
    )
    this.cleanupTimer.unref()
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /** 清理超过 TTL 的终态任务，防止长跑服务内存泄漏 */
  private cleanupExpiredTasks(): void {
    const now = Date.now()
    let removed = 0
    for (const [taskId, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed') &&
        now - task.updatedAt > ModelCompressionService.TASK_TTL_MS
      ) {
        this.tasks.delete(taskId)
        removed++
      }
    }
    if (removed > 0) {
      this.logger.debug(`TTL 清理：已移除 ${removed} 个过期压缩任务`)
    }
  }
  /**
   * 创建压缩任务并异步执行
   */
  async startCompression(
    modelId: string,
    versionId: string | undefined,
    options: CompressionOptions = {},
  ): Promise<CompressionResult> {
    if (!this.meshoptReady) {
      throw new InternalServerErrorException('压缩服务尚未就绪，请稍后重试')
    }

    const algorithm = 'meshopt' as const
    const compressTexture = options.compressTexture ?? true

    // 校验模型存在
    const model = await this.modelRepo.findOne({ where: { id: modelId } })
    if (!model) throw new NotFoundException(`模型不存在: ${modelId}`)

    // 解析目标版本（默认 latest）
    let version: ModelVersion | null
    if (versionId) {
      version = await this.versionRepo.findOne({
        where: { id: versionId, model_id: modelId },
      })
    } else {
      version = await this.versionRepo.findOne({
        where: { model_id: modelId },
        order: { version_number: 'DESC' },
      })
    }
    if (!version) {
      throw new NotFoundException('目标版本不存在')
    }

    // 格式校验（仅 glb / gltf 支持）
    const fmt = (model.file_format || '').toLowerCase()
    if (fmt !== 'glb' && fmt !== 'gltf') {
      throw new BadRequestException(`仅支持 .glb / .gltf 模型压缩，当前格式：${fmt || '未知'}`)
    }

    const taskId = randomUUID()
    const task: CompressionTask = {
      taskId,
      modelId,
      versionId: version.id,
      algorithm,
      compressTexture,
      status: 'queued',
      stage: null,
      percentage: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.tasks.set(taskId, task)

    void this.runCompression(task, version, fmt).catch((e) => {
      this.logger.error(`压缩任务 ${taskId} 未捕获异常: ${e?.message || e}`)
    })

    return { taskId }
  }

  /** 查询任务 */
  getTask(taskId: string): CompressionTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 主流程
   */
  private async runCompression(
    task: CompressionTask,
    version: ModelVersion,
    fmt: 'glb' | 'gltf',
  ): Promise<void> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'model-compress-'))
    const srcPath = path.join(tmpDir, `src.${fmt}`)
    const dstPath = path.join(tmpDir, 'dst.glb')

    try {
      // 启动时已在 onModuleInit 中 await 过一次；此处复用已 resolved 的 promise
      this.updateTask(task, { stage: '准备 Meshopt 编码器', percentage: 2 })

      // ========== 1. 下载源文件 ==========
      this.updateTask(task, { status: 'downloading', stage: '下载源文件', percentage: 5 })
      if (!version.file_key) {
        throw new BadRequestException('版本缺少 file_key，无法读取源文件')
      }
      const stat = await this.minioService.statObject(version.file_key)
      const srcBuffer = await this.minioService.getObjectPartial(
        version.file_key,
        0,
        stat.size,
      )
      if (!srcBuffer || srcBuffer.length === 0) {
        throw new BadRequestException('源文件内容为空，无法压缩（可能上传未完成或文件损坏）')
      }
      await fs.writeFile(srcPath, srcBuffer)
      task.originalSize = srcBuffer.length

      // ========== 2. 解析 glTF ==========
      this.updateTask(task, { status: 'compressing', stage: '解析 glTF', percentage: 15 })

      // 注册扩展 + encoder/decoder（让读 / 写都能识别 meshopt 编码）
      const io = new NodeIO()
        .registerExtensions([EXTMeshoptCompression, EXTTextureWebP])
        .registerDependencies({
          'meshopt.encoder': MeshoptEncoder,
          'meshopt.decoder': MeshoptDecoder,
        })

      const document = await io.read(srcPath)

      // 启用 meshopt 扩展（必选 = true，写出时被实际编码）
      document.createExtension(EXTMeshoptCompression).setRequired(true)
      // 仅在压缩纹理时启用 WebP 扩展并标记为必选，避免无 WebP 纹理却声明 required
      if (task.compressTexture) {
        document.createExtension(EXTTextureWebP).setRequired(true)
      }

      // ========== 3. 数据优化（去重 + 焊接 + 剪枝） ==========
      this.updateTask(task, { stage: '顶点去重焊接', percentage: 30 })
      // 注：@gltf-transform/functions 4.x 的 weld() 只支持按位精确合并（无 tolerance 选项，
      // 从 2024 年 4 月起 lossy weld 已被移除）
      await document.transform(
        dedup(),
        weld(),
        prune(),
      )

      // ========== 4. 纹理转 WebP（可选） ==========
      if (task.compressTexture) {
        this.updateTask(task, { stage: '纹理转 WebP', percentage: 50 })
        await this.compressTexturesToWebP(document)
      }

      // ========== 5. Meshopt 几何压缩 ==========
      this.updateTask(task, { stage: '几何 Meshopt 压缩', percentage: 75 })
      await document.transform(
        meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
      )

      // ========== 6. 导出 GLB ==========
      this.updateTask(task, { stage: '导出 GLB', percentage: 90 })
      await io.write(dstPath, document)
      const dstBuffer = await fs.readFile(dstPath)
      task.compressedSize = dstBuffer.length
      task.compressionRatio = task.originalSize
        ? Number((dstBuffer.length / task.originalSize).toFixed(3))
        : undefined

      // ========== 7. 上传回 MinIO ==========
      this.updateTask(task, { status: 'uploading', stage: '回传上传', percentage: 94 })
      const baseName = version.file_key.replace(/\.[^.]+$/, '')
      const newFileKey = `${baseName}.compressed.${randomUUID().slice(0, 8)}.glb`
      await this.minioService.putObject(
        newFileKey,
 dstBuffer,
        'model/gltf-binary',
      )
      const newUrl = this.minioService.getPublicUrl(newFileKey)

      // ========== 8. 写入新版本（事务：防止 version 与 model 计数不一致） ==========
      this.updateTask(task, { stage: '落库', percentage: 98 })
      const saved = await this.dataSource.transaction(async (manager) => {
        const model = await manager.findOne(Model, {
          where: { id: task.modelId },
          lock: { mode: 'pessimistic_write' },
        })
        if (!model) {
          throw new NotFoundException('模型在压缩过程中被删除')
        }
        const newVersionNumber = model.version_count + 1
        const newVersion = manager.create(ModelVersion, {
          model_id: model.id,
          version_number: newVersionNumber,
          file_url: newUrl,
          file_size: dstBuffer.length,
          file_key: newFileKey,
          commit_message: `压缩自版本 ${version.version_number}${
            task.compressTexture ? '（含 WebP 纹理）' : ''
          }`,
        })
        const savedVersion = await manager.save(ModelVersion, newVersion)

        model.version_count = newVersionNumber
        model.file_url = newUrl
        model.file_size = dstBuffer.length
        model.file_key = newFileKey
        await manager.save(Model, model)

        return savedVersion
      })

      this.updateTask(task, {
        status: 'completed',
        stage: null,
        percentage: 100,
        newVersionId: saved.id,
      })
      this.logger.log(
        `压缩完成 ${task.taskId}: 模型=${task.modelId}, ${task.originalSize}→${task.compressedSize}B, ratio=${task.compressionRatio}`,
      )
    } catch (e: any) {
      this.logger.error(`压缩任务 ${task.taskId} 失败: ${e?.message || e}`)
      this.updateTask(task, {
        status: 'failed',
        errorMessage: e?.message || String(e),
      })
    } finally {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  }

  /** 更新任务状态 */
  private updateTask(
    task: CompressionTask,
    patch: Partial<CompressionTask>,
  ): void {
    Object.assign(task, patch, { updatedAt: Date.now() })
    this.tasks.set(task.taskId, task)
  }

  /**
   * 纹理转 WebP（quality=80，effort=4）
   * 跳过：已是 webp / URI 引用纹理 / 损坏纹理
   * 只有真的变小才覆盖
   */
  private async compressTexturesToWebP(document: any): Promise<void> {
    const root = document.getRoot()
    const textures = root.listTextures() as Array<any>
    for (const texture of textures) {
      const mime = texture.getMimeType()
      if (mime === 'image/webp') continue // 已是 webp
      const image = texture.getImage()
      if (!image || typeof image === 'string') continue // URI 引用无法压缩

      try {
        const imageData = Buffer.isBuffer(image) ? image : Buffer.from(image as Uint8Array)
        const webp = await sharp(imageData).webp({ quality: 80, effort: 4 }).toBuffer()
        if (webp.length < imageData.length) {
          texture.setImage(webp)
          texture.setMimeType('image/webp')
        }
      } catch (e: any) {
        // 单张纹理失败不影响整体（warn 由 this.logger 接管，不再丢进虚空）
        this.logger.warn(`纹理压缩失败：${e?.message || e}`)
      }
    }
  }
}
