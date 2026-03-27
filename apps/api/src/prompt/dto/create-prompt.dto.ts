import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreatePromptDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  content!: string;
}
