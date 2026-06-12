import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/**
 * 分片上传会话实体
 *
 * 持久化每个分片上传任务的状态，支持断点续传和孤儿 session 清理。
 *
 * 生命周期：
 *   pending（创建）→ completed（成功合并）/ aborted（用户取消 / 清理）
 *
 * 关键字段：
 *   upload_id    - MinIO Multipart UploadId
 *   object_key   - MinIO 中的对象 key（labs/models/yyyy/MM/{uuid}.glb）
 *   uploaded_parts - 已上传分片映射 { "1": "etag-xxx", "2": "etag-yyy" }
 */
@Entity('upload_sessions')
@Index('idx_upload_id', ['upload_id'], { unique: true })
@Index('idx_status_created', ['status', 'created_at'])
export class UploadSession {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** MinIO Multipart UploadId（MinIO 生成的唯一标识） */
  @Column({ length: 100, unique: true })
  upload_id: string

  /** MinIO 中的对象 key，上传完成后用作 file_key 写业务表 */
  @Column({ length: 1024 })
  object_key: string

  /** 存储桶名（默认 three-mode，便于将来多 bucket 扩展） */
  @Column({ length: 100, default: 'three-mode' })
  bucket: string

  /** 原始文件名（用于显示） */
  @Column({ length: 255 })
  file_name: string

  /** 文件总大小（字节） */
  @Column({ type: 'bigint' })
  file_size: number

  /** MIME 类型（image/png、model/gltf-binary 等） */
  @Column({ length: 100, nullable: true })
  mime_type: string

  /** 业务类型：model / model-version / resource-image / resource-video / marker-icon / thumbnail */
  @Column({ length: 50 })
  biz_type: string

  /**
   * 状态
   * - pending: 创建后未完成（用户可能断网/刷新）
   * - completed: 已成功合并分片
   * - aborted: 已取消或被定时清理
   */
  @Column({
    type: 'enum',
    enum: ['pending', 'completed', 'aborted'],
    default: 'pending',
  })
  status: 'pending' | 'completed' | 'aborted'

  /**
   * 已上传分片映射
   * 格式：{ "1": "etag-abc", "2": "etag-def" }
   * 用于断点续传时快速查找哪些分片已上传
   */
  @Column({ type: 'json', nullable: true })
  uploaded_parts: Record<string, string>

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
