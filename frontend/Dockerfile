# 前端 Nginx 服务容器（直接使用本地构建产物）
FROM nginx:1.27-alpine

# 复制构建产物
COPY frontend/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
