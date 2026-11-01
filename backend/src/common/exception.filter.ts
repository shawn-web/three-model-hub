import { Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

/**
 * 全局异常过滤器
 * 捕获所有异常并打印详细日志，方便调试
 */
@Catch()
export class ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      // ValidationPipe 把 class-validator 错误放进 getResponse()，默认 exception.message 只有
      // 'Bad Request Exception'，会丢失字段级错误。这里同时打印 response 让日志可定位
      const resp = exception.getResponse()
      if (typeof resp === 'string') {
        message = resp
      } else {
        const respMessage = (resp as { message?: unknown } | undefined)?.message
        message = typeof respMessage === 'string' ? respMessage : exception.message
      }
      console.error('[异常过滤器] 响应体:', resp)
    }

    console.error('[异常过滤器] 状态:', status)
    console.error('[异常过滤器] 消息:', message)
    console.error('[异常过滤器] 堆栈:', exception instanceof Error ? exception.stack : exception)

    response.status(status).json({ statusCode: status, message })
  }
}
