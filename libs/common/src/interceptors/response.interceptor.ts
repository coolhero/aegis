import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

interface WrappedResponse<T> {
  data: T;
  statusCode: number;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, WrappedResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<WrappedResponse<T> | T> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();

    // Exclude health endpoint from wrapping
    if (request.url.startsWith('/health')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: T) => ({
        data,
        statusCode: response.statusCode,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
