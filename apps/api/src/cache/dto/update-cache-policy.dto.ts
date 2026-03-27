import { IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class UpdateCachePolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(1.0)
  similarity_threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(2592000) // 30 days max
  ttl_seconds?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
