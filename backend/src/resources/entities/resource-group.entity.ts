import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm'
import { Resource } from './resource.entity'

/**
 * 资源分组实体
 */
@Entity('resource_groups')
export class ResourceGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 100 })
  name: string

  @Column({ default: 0 })
  sort_order: number

  @CreateDateColumn()
  created_at: Date

  @OneToMany(() => Resource, (r) => r.group)
  resources: Resource[]
}
