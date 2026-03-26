import { IsIn, IsOptional, IsDateString } from 'class-validator';

export class AnalyticsQueryDto {
  @IsIn(['model', 'team', 'user'])
  groupBy!: string;

  @IsIn(['daily', 'weekly', 'monthly'])
  period!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
