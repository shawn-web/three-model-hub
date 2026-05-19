import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ExceptionFilter } from './common/exception.filter'

/**
 * 应用启动入口
 * 启用 CORS 以支持前端跨域访问
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // 启用 CORS，允许前端开发服务器访问
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })

  // 全局 API 前缀
  app.setGlobalPrefix('api')

  // 全局异常过滤器，打印详细错误日志
  app.useGlobalFilters(new ExceptionFilter())

  const port = process.env.PORT || 3000
  await app.listen(port)
  console.log(`[后端服务] 已启动，监听端口: ${port}`)
}
bootstrap()
