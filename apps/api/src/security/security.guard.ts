import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SecurityPolicyService } from './security-policy.service';
import { GuardPipelineService } from './guard-pipeline.service';

@Injectable()
export class SecurityGuard implements CanActivate {
  private readonly logger = new Logger(SecurityGuard.name);

  constructor(
    private readonly policyService: SecurityPolicyService,
    private readonly pipeline: GuardPipelineService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantContext = request.tenantContext;

    if (!tenantContext?.orgId) {
      return true; // No tenant context — skip guard (internal request)
    }

    const policy = await this.policyService.getPolicy(tenantContext.orgId);

    // Check bypass
    const bypassHeader = request.headers['x-guard-bypass'];
    const userRole = request.user?.role ?? tenantContext.role;
    const bypass =
      bypassHeader === 'true' &&
      userRole &&
      policy.bypassRoles.includes(userRole);

    // Extract user messages from request body
    const messages = request.body?.messages;
    if (!messages || !Array.isArray(messages)) {
      return true; // No messages to scan
    }

    const userMessages = messages.filter(
      (m: any) => m.role === 'user' && typeof m.content === 'string',
    );

    if (userMessages.length === 0) {
      return true;
    }

    const requestId = request.id ?? randomUUID();
    request.guardRequestId = requestId;

    // Scan each user message
    for (const msg of userMessages) {
      const result = await this.pipeline.scanInput(
        msg.content,
        policy,
        requestId,
        bypass,
      );

      if (!result.allowed) {
        throw new ForbiddenException({
          error: 'prompt_injection_detected',
          scanner: result.results.find((r) => r.result.decision === 'block')
            ?.scannerType ?? 'unknown',
        });
      }

      // Replace message content with transformed (masked) version
      if (result.transformedInput && result.transformedInput !== msg.content) {
        msg.content = result.transformedInput;
        request.guardMaskedInput = true;
      }
    }

    // Store policy on request for interceptor use
    request.securityPolicy = policy;
    request.guardBypassed = bypass;

    if (bypass) {
      this.logger.log(
        `Guard bypassed by user ${tenantContext.userId} (role: ${userRole})`,
      );
    }

    return true;
  }
}
