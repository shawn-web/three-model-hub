import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { ModelVersion } from './model-version.entity'

/**
 * 3D 模型实体
 * 存储模型的基本信息和文件引用
 */
@Entity('models')
export class Model {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  /** 标签数组，JSON 格式存储，如 ["建筑","现代"] */
  @Column({ type: 'json', nullable: true })
  tags: string[]

  /** 文件服务返回的文件访问 URL（MinIO 公开访问 URL，可能较长） */
  @Column({ length: 1024 })
  file_url: string

  /** 原始文件名 */
  @Column({ length: 255, nullable: true })
  file_name: string

  /** 文件大小（字节） */
  @Column({ type: 'bigint', default: 0 })
  file_size: number

  /** 文件格式：glb、gltf 等 */
  @Column({ length: 20, default: 'glb' })
  file_format: string

  /** 文件在 MinIO 中的 objectKey（格式：labs/models/yyyy/MM/{uuid}.glb），用于删除/复制 */
  @Column({ length: 1024, nullable: true })
  file_key: string

  /** 缩略图 URL（公开访问 URL，可能较长） */
  @Column({ length: 1024, nullable: true })
  thumbnail_url: string

  /** 版本总数 */
  @Column({ default: 1 })
  version_count: number

  /** 是否公开可见 */
  @Column({ default: true })
  is_public: boolean

  /** 下载次数 */
  @Column({ default: 0 })
  download_count: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => ModelVersion, (version) => version.model)
  versions: ModelVersion[]
}
