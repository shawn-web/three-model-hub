import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 扩展 upload_sessions.upload_id 列长度：100 → 255
 *
 * 背景：MinIO 的 uploadId 可能超过 100 字符，导致截断或存储失败。
 */
export class IncreaseUploadIdLength20260715113409 implements MigrationInterface {
  name = 'IncreaseUploadIdLength20260715113409'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`upload_sessions\` MODIFY \`upload_id\` VARCHAR(255) NOT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`upload_sessions\` MODIFY \`upload_id\` VARCHAR(100) NOT NULL`,
    )
  }
}
