import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptTemplate } from './prompt-template.entity';
import { PromptVersion } from './prompt-version.entity';
import { AbTest } from './ab-test.entity';
import { AbTestVariant } from './ab-test-variant.entity';
import { PromptUsageStat } from './prompt-usage-stat.entity';
import { PromptController } from './prompt.controller';
import { PromptService } from './prompt.service';
import { AbTestService } from './ab-test.service';
import { PromptResolverService } from './prompt-resolver.service';
import { PromptStatsService } from './prompt-stats.service';
import { VariableParserService } from './variable-parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromptTemplate,
      PromptVersion,
      AbTest,
      AbTestVariant,
      PromptUsageStat,
    ]),
  ],
  controllers: [PromptController],
  providers: [
    PromptService,
    AbTestService,
    PromptResolverService,
    PromptStatsService,
    VariableParserService,
  ],
  exports: [PromptResolverService],
})
export class PromptModule {}
