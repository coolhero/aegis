import { IsArray, ValidateNested, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AbTestVariantDto {
  @IsUUID()
  version_id!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  weight!: number;
}

export class CreateAbTestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbTestVariantDto)
  variants!: AbTestVariantDto[];
}
