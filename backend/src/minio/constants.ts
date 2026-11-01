/**
 * MinIO 模块共享常量
 *
 * 避免 bucket 名称在 service、entity、test、controller 中重复硬编码。
 */

/** 默认 bucket 名（与 MINIO_BUCKET 未设置时的回退值一致） */
export const DEFAULT_MINIO_BUCKET = 'three-model-hub'
