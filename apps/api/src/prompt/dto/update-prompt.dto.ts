import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdatePromptDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}
