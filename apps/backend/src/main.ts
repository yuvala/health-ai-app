import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import "reflect-metadata";
import { AppModule } from "./app.module";
import { HttpExceptionLoggingFilter } from "./logging/http-exception-logging.filter";

type RequestWithContext = {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
  method: string;
  originalUrl: string;
  user?: {
    id?: string;
  };
  ip?: string;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger("HTTP");

  app.enableCors({
    origin: config.get<string>("FRONTEND_ORIGIN", "http://localhost:5173")
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  app.use((req: RequestWithContext, res: any, next: () => void) => {
    const incomingRequestId = req.headers["x-request-id"];
    const requestId =
      typeof incomingRequestId === "string"
        ? incomingRequestId
        : Array.isArray(incomingRequestId)
          ? incomingRequestId[0]
          : randomUUID();

    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.log(
        JSON.stringify({
          type: "http",
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(1)),
          userId: req.user?.id,
          ip: req.ip,
          timestamp: new Date().toISOString()
        })
      );
    });

    next();
  });

  app.useGlobalFilters(new HttpExceptionLoggingFilter());

  const port = config.get<number>("PORT", 4000);
  await app.listen(port);
  logger.log(JSON.stringify({ type: "startup", message: `Backend running on http://localhost:${port}` }));
}

bootstrap();
