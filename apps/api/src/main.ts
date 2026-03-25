import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@aegis/common/filters/http-exception.filter';
import { ResponseInterceptor } from '@aegis/common/interceptors/response.interceptor';
import { LoggerService } from '@aegis/common/logger/logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(configService, logger));
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`AEGIS API is running on port ${port}`, 'Bootstrap');
}

bootstrap();
