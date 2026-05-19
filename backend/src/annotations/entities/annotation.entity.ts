import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Scene } from '../../scenes/entities/scene.entity'

/**
 * 批注实体
 * 在场景模型上的特定位置添加文字批注，用于评审和协作沟通
 */
@Entity('annotations')
export class Annotation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  scene_id: string

  @ManyToOne(() => Scene, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scene_id' })
  scene: Scene

  /** 批注在 3D 空间中的位置 { x, y, z } */
  @Column('simple-json')
  position: { x: number; y: number; z: number }

  /** 批注文本内容 */
  @Column({ length: 500 })
  text: string

  /** 批注作者（可选） */
  @Column({ length: 50, nullable: true })
  author: string

  @CreateDateColumn()
  created_at: Date
}
