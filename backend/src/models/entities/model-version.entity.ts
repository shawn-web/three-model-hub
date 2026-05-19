import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Model } from './model.entity'

/**
 * 模型版本实体
 * 每次上传新文件都会创建新版本，支持版本回溯和对比
 */
@Entity('model_versions')
export class ModelVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Model, (model) => model.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'model_id' })
  model: Model

  @Column()
  model_id: string

  /** 版本号，每个模型内自增 */
  @Column()
  version_number: number

  /** 该版本文件的 URL */
  @Column({ length: 500 })
  file_url: string

  /** 文件大小（字节） */
  @Column({ type: 'bigint', default: 0 })
  file_size: number

  /** 文件存储桶名，用于删除文件 */
  @Column({ length: 255, nullable: true })
  file_bucket: string

  /** 文件在存储服务中的 key/fileName，用于删除文件 */
  @Column({ length: 500, nullable: true })
  file_key: string

  /** SHA256 哈希值，用于完整性校验 */
  @Column({ length: 64, nullable: true })
  file_hash: string

  /** 模型元数据（顶点数、材质数、包围盒等） */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>

  /** 版本说明，如 "修复了 UV 映射" */
  @Column({ length: 500, nullable: true })
  commit_message: string

  @CreateDateColumn()
  created_at: Date
}
