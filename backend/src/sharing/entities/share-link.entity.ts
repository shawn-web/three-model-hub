import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Scene } from '../../scenes/entities/scene.entity'
import { Model } from '../../models/entities/model.entity'

/**
 * 分享链接实体
 * 支持通过 token 分享场景或模型
 */
@Entity('share_links')
export class ShareLink {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** 随机生成的分享令牌 */
  @Column({ unique: true, length: 32 })
  token: string

  @ManyToOne(() => Scene, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene | null

  @Column({ nullable: true })
  scene_id: string | null

  @ManyToOne(() => Model, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'model_id' })
  model: Model | null

  @Column({ nullable: true })
  model_id: string | null

  /** 权限类型：view 或 download */
  @Column({ length: 20, default: 'view' })
  permission: string

  /** 过期时间，null 表示永不过期 */
  @Column({ type: 'datetime', nullable: true })
  expires_at: Date | null

  /** 是否有效 */
  @Column({ default: true })
  is_active: boolean

  /** 访问次数 */
  @Column({ default: 0 })
  access_count: number

  @CreateDateColumn()
  created_at: Date
}
