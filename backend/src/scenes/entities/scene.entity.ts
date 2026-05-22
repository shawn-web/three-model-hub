import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { SceneModel } from './scene-model.entity'
import { SceneImage } from './scene-image.entity'

/**
 * 场景实体
 * 一个场景可以包含多个模型，独立配置相机、灯光、背景等
 */
@Entity('scenes')
export class Scene {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  /** 缩略图 URL，默认使用占位图 */
  @Column({ length: 500, nullable: true })
  thumbnail_url: string

  /**
   * 场景配置 JSON
   * 包含：相机位置/角度、灯光、背景色、自动旋转等
   */
  @Column({ type: 'json', nullable: true })
  scene_config: Record<string, any>

  /** 是否公开可见 */
  @Column({ default: true })
  is_public: boolean

  /** 标点数据 JSON */
  @Column({ type: 'json', nullable: true })
  markers: Record<string, any>

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => SceneModel, (sm) => sm.scene)
  scene_models: SceneModel[]

  @OneToMany(() => SceneImage, (si) => si.scene)
  scene_images: SceneImage[]
}
