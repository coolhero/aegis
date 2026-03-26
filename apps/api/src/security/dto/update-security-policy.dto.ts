import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomPiiPatternDto {
  @IsString()
  name!: string;

  @IsString()
  pattern!: string;

  @IsString()
  placeholder!: string;
}

export class UpdateSecurityPolicyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pii_categories?: string[];

  @IsOptional()
  @IsIn(['mask', 'reject', 'warn'])
  pii_action?: 'mask' | 'reject' | 'warn';

  @IsOptional()
  @IsBoolean()
  injection_defense_enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  content_filter_categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bypass_roles?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPiiPatternDto)
  custom_pii_patterns?: CustomPiiPatternDto[];
}
