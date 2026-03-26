import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityPolicy } from './entities/security-policy.entity';
import { GuardResult } from './entities/guard-result.entity';
import { InputNormalizer } from './scanners/normalizer';
import { PiiScanner } from './scanners/pii.scanner';
import { InjectionScanner } from './scanners/injection.scanner';
import { ContentScanner } from './scanners/content.scanner';
import { GuardPipelineService } from './guard-pipeline.service';
import { SecurityPolicyService } from './security-policy.service';
import { SecurityPolicyController } from './security-policy.controller';
import { SecurityGuard } from './security.guard';
import { GuardInterceptor } from './guard.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityPolicy, GuardResult])],
  controllers: [SecurityPolicyController],
  providers: [
    InputNormalizer,
    PiiScanner,
    InjectionScanner,
    ContentScanner,
    GuardPipelineService,
    SecurityPolicyService,
    SecurityGuard,
    GuardInterceptor,
  ],
  exports: [
    SecurityGuard,
    GuardInterceptor,
    GuardPipelineService,
    SecurityPolicyService,
    PiiScanner,
  ],
})
export class SecurityModule {}
