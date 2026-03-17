import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";

@Catch()
export class HttpExceptionLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<any>();
    const res = ctx.getResponse<any>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionMessage =
      isHttpException ? exception.message : exception instanceof Error ? exception.message : "Unexpected error";

    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      JSON.stringify({
        type: "error",
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        userId: req.user?.id,
        statusCode: status,
        message: exceptionMessage,
        timestamp: new Date().toISOString()
      }),
      stack
    );

    const responsePayload = isHttpException
      ? exception.getResponse()
      : { message: "Internal server error" };

    res.status(status).json(responsePayload);
  }
}
