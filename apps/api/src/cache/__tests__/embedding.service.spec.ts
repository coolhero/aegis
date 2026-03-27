import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();

    service = module.get(EmbeddingService);
  });

  it('should return null when API key is empty', async () => {
    const result = await service.embed('test query');
    expect(result).toBeNull();
  });

  it('should return null for empty text', async () => {
    const result = await service.embed('');
    expect(result).toBeNull();
  });

  it('should return null for whitespace-only text', async () => {
    const result = await service.embed('   ');
    expect(result).toBeNull();
  });
});
