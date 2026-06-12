import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { GeoMapModel } from './geo-map-model.entity'

/**
 * 地理地图实体
 * 独立于场景，管理 3D 模型在地球上的地理定位、标点、底图配置
 */
@Entity('geo_maps')
export class GeoMap {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ length: 500, nullable: true })
  thumbnail_url: string

  /** 地图配置：底图厂商、类型、视角、标点等 */
  @Column({ type: 'json', nullable: true })
  config: Record<string, unknown>

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date

  @OneToMany(() => GeoMapModel, (gmm) => gmm.geo_map, { cascade: true })
  geo_map_models: GeoMapModel[]
}
