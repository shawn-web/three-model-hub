import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Scene } from './scene.entity'

/**
 * 场景媒体实体
 * 支持图片、视频、文字标注、网页嵌入
 */
@Entity('scene_images')
export class SceneImage {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Scene, (scene) => scene.scene_images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene

  @Column()
  scene_id: string

  /** 媒体类型：image/video/text/iframe */
  @Column({ length: 20, default: 'image' })
  type: string

  /** 资源 URL（图片/视频） */
  @Column({ length: 500, nullable: true })
  url: string

  /** 媒体名称 */
  @Column({ length: 255 })
  name: string

  /** 宽度 */
  @Column()
  width: number

  /** 高度 */
  @Column()
  height: number

  /** 3D 位置 [x, y, z] */
  @Column({ type: 'json', nullable: true })
  position: Record<string, any>

  /** 缩放 [x, y] */
  @Column({ type: 'json', nullable: true })
  scale: Record<string, any>

  /** 旋转（Z 轴弧度） */
  @Column({ type: 'json', nullable: true })
  rotation: Record<string, any>

  /** 是否可见 */
  @Column({ default: true })
  visible: boolean

  /** 是否广告牌模式 */
  @Column({ default: true })
  billboard: boolean

  /** 视频自动播放 */
  @Column({ type: 'boolean', nullable: true })
  autoplay: boolean

  /** 视频静音 */
  @Column({ type: 'boolean', nullable: true })
  muted: boolean

  /** 视频循环 */
  @Column({ type: 'boolean', nullable: true })
  loop: boolean

  /** 文字标注内容 */
  @Column({ length: 500, nullable: true })
  text: string

  /** 文字字号 */
  @Column({ type: 'int', nullable: true })
  fontSize: number

  /** 文字颜色 */
  @Column({ length: 20, nullable: true })
  fontColor: string

  /** 网页嵌入 URL */
  @Column({ length: 500, nullable: true })
  iframeUrl: string

  /** 排序顺序 */
  @Column({ default: 0 })
  sort_order: number
}
