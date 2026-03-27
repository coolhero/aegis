import { IsInt, Min } from 'class-validator';

export class PublishPromptDto {
  @IsInt()
  @Min(1)
  version!: number;
}
