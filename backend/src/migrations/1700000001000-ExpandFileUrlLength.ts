import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 字段长度扩展：500 → 1024
 *
 * 背景：tapp → MinIO 迁移后，file_url 变为 MinIO 公开访问 URL（带 hostname:port/bucket/key），
 *       加上可能的 CDN 域名，长度可能超过 500 字符。file_key 同样需要更长的空间。
 *
 * 变更表：
 *   - models:         file_url, file_key, thumbnail_url
 *   - model_versions: file_url, file_key
 *   - resources:      url, file_key, thumbnail_url
 *
 * 注意：MySQL VARCHAR 长度变更不会锁表（仅修改元数据），可在线执行。
 */
export class ExpandFileUrlLength1700000001000 implements MigrationInterface {
  name = 'ExpandFileUrlLength1700000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // models 表
    await queryRunner.query(`ALTER TABLE \`models\` MODIFY \`file_url\` VARCHAR(1024) NOT NULL`)
    await queryRunner.query(`ALTER TABLE \`models\` MODIFY \`file_key\` VARCHAR(1024) NULL`)
    await queryRunner.query(`ALTER TABLE \`models\` MODIFY \`thumbnail_url\` VARCHAR(1024) NULL`)

    // model_versions 表
    await queryRunner.query(`ALTER TABLE \`model_versions\` MODIFY \`file_url\` VARCHAR(1024) NOT NULL`)
    await queryRunner.query(`ALTER TABLE \`model_versions\` MODIFY \`file_key\` VARCHAR(1024) NULL`)

    // resources 表
    await queryRunner.query(`ALTER TABLE \`resources\` MODIFY \`url\` VARCHAR(1024) NOT NULL`)
    await queryRunner.query(`ALTER TABLE \`resources\` MODIFY \`file_key\` VARCHAR(1024) NULL`)
    await queryRunner.query(`ALTER TABLE \`resources\` MODIFY \`thumbnail_url\` VARCHAR(1024) NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚到 500（注意：若已有数据超过 500 字符会失败）
    await queryRunner.query(`ALTER TABLE \`models\` MODIFY \`file_url\` VARCHAR(500) NOT NULL`)
    await queryRunner.query(`ALTER TABLE \`models\` MODIFY \`file_key\` VARCHAR(500) NULL`)
    await queryRunner.query(`ALTER TABLE \`models\` MODIFY \`thumbnail_url\` VARCHAR(500) NULL`)

    await queryRunner.query(`ALTER TABLE \`model_versions\` MODIFY \`file_url\` VARCHAR(500) NOT NULL`)
    await queryRunner.query(`ALTER TABLE \`model_versions\` MODIFY \`file_key\` VARCHAR(500) NULL`)

    await queryRunner.query(`ALTER TABLE \`resources\` MODIFY \`url\` VARCHAR(500) NOT NULL`)
    await queryRunner.query(`ALTER TABLE \`resources\` MODIFY \`file_key\` VARCHAR(500) NULL`)
    await queryRunner.query(`ALTER TABLE \`resources\` MODIFY \`thumbnail_url\` VARCHAR(500) NULL`)
  }
}
