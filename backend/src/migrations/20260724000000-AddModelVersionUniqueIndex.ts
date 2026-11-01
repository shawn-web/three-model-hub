import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 为 model_versions 表添加 (model_id, version_number) 复合唯一索引
 *
 * 背景：models.service / model-compression.service 的 version_number 自增
 *       依赖 pessimistic_write 锁防止并发重复，但数据库层缺少唯一约束兜底。
 *       若锁机制失效（如未来代码路径绕过事务），会产生重复版本号。
 */
export class AddModelVersionUniqueIndex20260724000000 implements MigrationInterface {
  name = 'AddModelVersionUniqueIndex20260724000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`idx_model_version_unique\` ON \`model_versions\` (\`model_id\`, \`version_number\`)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`idx_model_version_unique\` ON \`model_versions\``,
    )
  }
}
