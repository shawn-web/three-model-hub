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
      message = exception.message
    }

    console.error('[异常过滤器] 状态:', status)
    console.error('[异常过滤器] 消息:', message)
    console.error('[异常过滤器] 堆栈:', exception instanceof Error ? exception.stack : exception)

    response.status(status).json({ statusCode: status, message })
  }
}
