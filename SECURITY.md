# Security Policy

## 支持的版本

下表列出了当前获得安全更新的 three-model-hub 版本：

| 版本 | 支持情况 |
|------|----------|
| 0.1.x | ✅ 活跃支持 |
| < 0.1 | ❌ 不再支持 |

## 报告漏洞

**请不要**通过公开 Issue（GitHub / Gitee 都一样）报告安全漏洞。

请通过以下方式私下报告：

1. 在 GitHub 发起 [Private Security Advisory](https://github.com/shawn-web/three-model-hub/security/advisories/new)（推荐）
2. 或在 [Gitee Issues](https://gitee.com/lishuaistart/three-model/issues) 提交 **私密** Issue（标题标注 `[SECURITY]`）
3. 或发送邮件到 `lishuaistart@163.com`

报告内容请包含：

- 漏洞类型与影响范围
- 复现步骤（PoC 截图或代码片段）
- 受影响的版本
- 你的联系方式

我们承诺：

- **48 小时内**确认收到报告
- **7 天内**给出修复计划
- 修复发布后**公开致谢**（除非你要求匿名）

## 安全最佳实践

部署 three-model-hub 时请遵循以下安全建议：

### 必须修改的默认值

- **MySQL 密码**：`MYSQL_ROOT_PASSWORD`、`DB_PASSWORD`
- **MinIO 凭证**：`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`
- **CORS 白名单**：生产环境必须设置 `CORS_ORIGINS`，不要留空
- **.env 文件权限**：`chmod 600 backend/.env`

> 早期提交历史中曾包含 `backend/.env`（已通过历史重写移除）。
> 若你曾在旧版本中使用过其中记录的 `FILE_SERVICE_TOKEN` 或数据库口令，
> **请立即轮换这些凭据**，不要假定历史移除等同于未被读取。

### 反向代理

- 生产环境**必须**使用 HTTPS（Nginx + Let's Encrypt）
- 不要直接暴露 MySQL（3306）和 MinIO（9000/9001）端口到公网

### 文件上传

- 项目默认限制单文件 ≤ 1GB（`MAX_UPLOAD_SIZE_MB`）
- 所有上传通过 NestJS 后端校验，不会被前端绕过
- 反向代理（nginx）需要相应调大 `client_max_body_size`

### 依赖更新

定期运行：

```bash
pnpm audit
pnpm update
```
