import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { GeoMap } from './geo-map.entity'

/**
 * 地图-模型关联实体
 * 一个地图可以关联多个模型，一个模型可以出现在多个地图中
 * 地理坐标存储在此关联表中（每个地图独立）
 */
@Entity('geo_map_models')
export class GeoMapModel {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => GeoMap, (gm) => gm.geo_map_models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'geo_map_id' })
  geo_map: GeoMap

  @Column()
  geo_map_id: string

  /** 关联的模型 ID */
  @Column()
  model_id: string

  @Column({ nullable: true })
  model_version_id: string

  @Column({ length: 255, nullable: true })
  display_name: string

  /** 地理定位信息（WGS84） */
  @Column({ type: 'json', nullable: true })
  geo_position: Record<string, unknown>

  @Column({ default: true })
  visible: boolean

  @Column({ default: 0 })
  sort_order: number
}
