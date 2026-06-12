import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Scene } from './scene.entity'

/**
 * 场景-模型关联实体
 * 一个场景可以包含多个模型，每个模型有独立的变换和材质配置
 */
@Entity('scene_models')
export class SceneModel {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Scene, (scene) => scene.scene_models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene

  @Column()
  scene_id: string

  /** 关联的模型 ID */
  @Column()
  model_id: string

  /** 指定模型版本 ID，null 表示使用最新版本 */
  @Column({ nullable: true })
  model_version_id: string

  /**
   * 变换数据 JSON
   * { position: [x,y,z], rotation: [x,y,z], scale: [x,y,z] }
   */
  @Column({ type: 'json', nullable: true })
  transform: Record<string, any>

  /** 材质覆盖配置 */
  @Column({ type: 'json', nullable: true })
  material_overrides: Record<string, any>

  /** 是否在场景中可见 */
  @Column({ default: true })
  visible: boolean

  /** 排序顺序 */
  @Column({ default: 0 })
  sort_order: number

  /** 显示名称，可覆盖原始模型名 */
  @Column({ length: 255, nullable: true })
  display_name: string

  /**
   * 地理定位信息（WGS84）
   * { longitude, latitude, altitude, heading, pitch, roll, scale }
   */
  @Column({ type: 'json', nullable: true, comment: '地理定位信息' })
  geo_position: Record<string, any>
}
