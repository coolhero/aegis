import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { GuardPipelineService } from './guard-pipeline.service';
import { SecurityPolicyService } from './security-policy.service';
import { PiiScanner } from './scanners/pii.scanner';

@Injectable()
export class GuardInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GuardInterceptor.name);

  constructor(
    private readonly pipeline: GuardPipelineService,
    private readonly policyService: SecurityPolicyService,
    private readonly piiScanner: PiiScanner,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Skip if bypassed or no tenant context
    if (request.guardBypassed || !request.tenantContext?.orgId) {
      return next.handle();
    }

    // Skip if streaming — streaming output filtering is handled in gateway controller
    if (request.body?.stream) {
      return next.handle();
    }

    return next.handle().pipe(
      map(async (response) => {
        if (!response) return response;

        const policy =
          request.securityPolicy ??
          (await this.policyService.getPolicy(request.tenantContext.orgId));

        const requestId = request.guardRequestId ?? 'unknown';

        // Scan output for PII and content
        const content = response?.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          const { transformed, blocked } = await this.pipeline.scanOutput(
            content,
            policy,
            requestId,
          );

          if (transformed !== content) {
            response.choices[0].message.content = transformed;
          }
        }

        return response;
      }),
    );
  }
}
