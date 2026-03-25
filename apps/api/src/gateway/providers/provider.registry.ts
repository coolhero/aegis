import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ProviderAdapter,
  Provider,
  ProviderType,
  Model,
} from '@aegis/common/gateway';
import { LoggerService } from '@aegis/common/logger/logger.service';
import { OpenAIAdapter } from './openai.adapter';
import { AnthropicAdapter } from './anthropic.adapter';

export interface ResolvedProvider {
  adapter: ProviderAdapter;
  apiKey: string;
  baseUrl?: string;
  model: Model;
  provider: Provider;
}

@Injectable()
export class ProviderRegistry implements OnModuleInit {
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(
    @InjectRepository(Provider)
    private readonly providerRepo: Repository<Provider>,
    @InjectRepository(Model)
    private readonly modelRepo: Repository<Model>,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    // Register built-in adapters
    this.registerAdapter(new OpenAIAdapter());
    this.registerAdapter(new AnthropicAdapter());
  }

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  registerAdapter(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.providerType, adapter);
    this.logger.log(
      `Registered provider adapter: ${adapter.providerType}`,
      'ProviderRegistry',
    );
  }

  /**
   * Resolve a model name to the correct provider adapter, API key, and model info.
   */
  async resolve(modelName: string): Promise<ResolvedProvider | null> {
    const model = await this.modelRepo.findOne({
      where: { name: modelName, enabled: true },
      relations: ['provider'],
    });

    if (!model) {
      return null;
    }

    const provider = model.provider;
    if (!provider || !provider.enabled) {
      return null;
    }

    const adapter = this.adapters.get(provider.type);
    if (!adapter) {
      return null;
    }

    // Get API key: prefer provider-level encrypted key, fallback to env
    const apiKey = this.getApiKey(provider);
    if (!apiKey) {
      this.logger.error(
        `No API key found for provider ${provider.name}`,
        'ProviderRegistry',
      );
      return null;
    }

    return {
      adapter,
      apiKey,
      baseUrl: provider.baseUrl || undefined,
      model,
      provider,
    };
  }

  private getApiKey(provider: Provider): string | undefined {
    // For now, use env variables. Encrypted key support in future feature.
    if (provider.apiKeyEncrypted) {
      // TODO: F003 will add proper encryption/decryption
      return provider.apiKeyEncrypted;
    }

    switch (provider.type) {
      case ProviderType.OPENAI:
        return this.configService.get<string>('OPENAI_API_KEY');
      case ProviderType.ANTHROPIC:
        return this.configService.get<string>('ANTHROPIC_API_KEY');
      default:
        return undefined;
    }
  }

  /**
   * Seed default providers and models if none exist.
   */
  private async seedDefaults(): Promise<void> {
    const providerCount = await this.providerRepo.count();
    if (providerCount > 0) {
      this.logger.log(
        'Providers already seeded, skipping',
        'ProviderRegistry',
      );
      return;
    }

    this.logger.log('Seeding default providers and models...', 'ProviderRegistry');

    // Seed OpenAI provider
    const openaiProvider = this.providerRepo.create({
      name: 'OpenAI',
      type: ProviderType.OPENAI,
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
      healthStatus: 'unknown',
      weight: 1,
    });
    await this.providerRepo.save(openaiProvider);

    // Seed Anthropic provider
    const anthropicProvider = this.providerRepo.create({
      name: 'Anthropic',
      type: ProviderType.ANTHROPIC,
      baseUrl: 'https://api.anthropic.com',
      enabled: true,
      healthStatus: 'unknown',
      weight: 1,
    });
    await this.providerRepo.save(anthropicProvider);

    // Seed models
    const models = [
      {
        providerId: openaiProvider.id,
        name: 'gpt-4o',
        displayName: 'GPT-4o',
        inputPricePerToken: 0.0000025,
        outputPricePerToken: 0.00001,
        maxTokens: 16384,
        enabled: true,
      },
      {
        providerId: openaiProvider.id,
        name: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        inputPricePerToken: 0.00000015,
        outputPricePerToken: 0.0000006,
        maxTokens: 16384,
        enabled: true,
      },
      {
        providerId: anthropicProvider.id,
        name: 'claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4',
        inputPricePerToken: 0.000003,
        outputPricePerToken: 0.000015,
        maxTokens: 8192,
        enabled: true,
      },
      {
        providerId: anthropicProvider.id,
        name: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        inputPricePerToken: 0.0000008,
        outputPricePerToken: 0.000004,
        maxTokens: 8192,
        enabled: true,
      },
    ];

    for (const modelData of models) {
      const model = this.modelRepo.create(modelData);
      await this.modelRepo.save(model);
    }

    this.logger.log(
      `Seeded ${models.length} models across 2 providers`,
      'ProviderRegistry',
    );
  }
}
