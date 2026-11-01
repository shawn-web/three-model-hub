#!/bin/sh
# 后端生产入口脚本：先执行数据库迁移，再启动应用

echo "正在执行数据库迁移..."
node ./scripts/migrate-prod.js

if [ $? -ne 0 ]; then
  echo "数据库迁移失败，退出"
  exit 1
fi

echo "迁移完成，启动应用..."
exec node dist/main.js
