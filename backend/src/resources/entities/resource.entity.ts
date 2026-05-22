import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { ResourceGroup } from './resource-group.entity'

/** 资源类型枚举 */
export enum ResourceType {
  IMAGE = 'image',
  VIDEO = 'video',
}

/**
 * 资源实体
 * 统一管理图片和视频资源
 */
@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  name: string

  @Column({ type: 'enum', enum: ResourceType })
  type: ResourceType

  @Column({ length: 500 })
  url: string

  @Column({ type: 'bigint', default: 0 })
  file_size: number

  @Column({ length: 100, nullable: true })
  mime_type: string

  @Column({ nullable: true })
  width: number

  @Column({ nullable: true })
  height: number

  /** 视频时长（秒），图片为 null */
  @Column({ type: 'float', nullable: true })
  duration: number

  @Column({ length: 500, nullable: true })
  thumbnail_url: string

  /** 文件 key，用于删除 */
  @Column({ length: 500, nullable: true })
  file_key: string

  @Column({ type: 'uuid', nullable: true })
  group_id: string

  @ManyToOne(() => ResourceGroup, (g) => g.resources, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'group_id' })
  group: ResourceGroup

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
