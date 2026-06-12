import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { ExceptionFilter } from './common/exception.filter'
import helmet from 'helmet'
import compression from 'compression'

// 必要的环境变量校验
// 数据库：DB_* 4 项
// MinIO：MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY / MINIO_BUCKET 4 项
const requiredEnvVars = [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
]
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`[启动失败] 缺少必要环境变量: ${varName}`)
    process.exit(1)
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // HTTP 安全头（CSP 关闭，因为 Three.js/GLB 模型加载需要宽泛的连接源）
  app.use(helmet({ contentSecurityPolicy: false }))
  // 响应压缩
  app.use(compression())

  // CORS：生产环境通过 CORS_ORIGINS 限制，开发环境允许所有来源
  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
      : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })

  // 全局 DTO 验证管道
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))

  // 全局 API 前缀
  app.setGlobalPrefix('api')

  // 全局异常过滤器，打印详细错误日志
  app.useGlobalFilters(new ExceptionFilter())

  const port = process.env.PORT || 3000
  await app.listen(port, '0.0.0.0')
  console.log(`[后端服务] 已启动，监听端口: ${port}`)
}
bootstrap()
