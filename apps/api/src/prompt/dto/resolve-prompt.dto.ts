import { IsObject, IsOptional } from 'class-validator';

export class ResolvePromptDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
