import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Scene } from '../../scenes/entities/scene.entity'

/**
 * 视点实体
 * 保存场景中相机的位置、目标、上方向等状态，便于快速恢复视角
 */
@Entity('viewpoints')
export class Viewpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  scene_id: string

  @ManyToOne(() => Scene, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene

  /** 视点名称 */
  @Column({ length: 100 })
  name: string

  /** 相机位置 { x, y, z } */
  @Column('simple-json')
  camera_position: { x: number; y: number; z: number }

  /** 相机目标点 { x, y, z } */
  @Column('simple-json')
  camera_target: { x: number; y: number; z: number }

  /** 相机上方向 { x, y, z }，可选 */
  @Column('simple-json', { nullable: true })
  camera_up: { x: number; y: number; z: number }

  /** 相机视场角，可选 */
  @Column({ type: 'float', nullable: true })
  fov: number

  @CreateDateColumn()
  created_at: Date
}
