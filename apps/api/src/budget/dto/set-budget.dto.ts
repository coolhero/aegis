import {
  IsNumber,
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
  IsUrl,
  Min,
} from 'class-validator';

export class SetBudgetDto {
  @IsNumber()
  @Min(0)
  token_limit!: number;

  @IsNumber()
  @Min(0)
  cost_limit_usd!: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  alert_thresholds?: number[];

  @IsOptional()
  @IsString()
  @IsUrl()
  webhook_url?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
