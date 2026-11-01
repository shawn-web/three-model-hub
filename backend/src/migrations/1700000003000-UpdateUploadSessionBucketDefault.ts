import { MigrationInterface, QueryRunner } from 'typeorm'
import { DEFAULT_MINIO_BUCKET } from '../minio/constants'

/**
 * 更新 upload_sessions.bucket 列默认值为新的 bucket 名
 *
 * 项目重命名后，默认 bucket 从 'three-mode' 改为 'three-model-hub'。
 * 该迁移确保已存在的数据库列默认值与实体、MinioService 保持一致。
 */
export class UpdateUploadSessionBucketDefault1700000003000 implements MigrationInterface {
  name = 'UpdateUploadSessionBucketDefault1700000003000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`upload_sessions\`
      ALTER COLUMN \`bucket\` SET DEFAULT '${DEFAULT_MINIO_BUCKET}'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚到 2000 建表时的默认值（three-model-hub），而非从未存在过的 'three-mode'
    await queryRunner.query(`
      ALTER TABLE \`upload_sessions\`
      ALTER COLUMN \`bucket\` SET DEFAULT 'three-model-hub'
    `)
  }
}
