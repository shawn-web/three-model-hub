import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 创建 upload_sessions 表
 *
 * 用途：持久化分片上传任务的状态，支持断点续传和孤儿 session 清理。
 *
 * 关键索引：
 *   - idx_upload_id: 唯一索引，按 uploadId 快速查找
 *   - idx_status_created: 复合索引，定时清理扫描 (status='pending' AND created_at < ...)
 */
export class CreateUploadSession1700000002000 implements MigrationInterface {
  name = 'CreateUploadSession1700000002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`upload_sessions\` (
        \`id\` varchar(36) NOT NULL,
        \`upload_id\` varchar(100) NOT NULL,
        \`object_key\` varchar(1024) NOT NULL,
        \`bucket\` varchar(100) NOT NULL DEFAULT 'three-mode',
        \`file_name\` varchar(255) NOT NULL,
        \`file_size\` bigint NOT NULL,
        \`mime_type\` varchar(100) NULL,
        \`biz_type\` varchar(50) NOT NULL,
        \`status\` enum('pending','completed','aborted') NOT NULL DEFAULT 'pending',
        \`uploaded_parts\` json NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`idx_upload_id\` (\`upload_id\`),
        INDEX \`idx_status_created\` (\`status\`, \`created_at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`upload_sessions\``)
  }
}
