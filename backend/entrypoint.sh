#!/bin/sh
# 后端生产入口脚本：先执行数据库迁移，再启动应用

echo "正在执行数据库迁移..."
node -e "const ds=require('./dist/data-source.prod');ds.initialize().then(d=>d.runMigrations().then(()=>{console.log('迁移完成');return d.destroy()}).catch(e=>{console.error('迁移失败:',e);d.destroy();process.exit(1)})).catch(e=>{console.error('数据源初始化失败:',e);process.exit(1)})"

if [ $? -ne 0 ]; then
  echo "数据库迁移失败，退出"
  exit 1
fi

echo "迁移完成，启动应用..."
exec node dist/main.js
