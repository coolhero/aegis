import { validate } from './env.validation';

describe('EnvironmentVariables validation', () => {
  const validEnv = {
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_USER: 'aegis',
    DATABASE_PASSWORD: 'aegis_dev',
    DATABASE_NAME: 'aegis',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    PORT: '3000',
    NODE_ENV: 'development',
  };

  it('should pass with all valid environment variables', () => {
    const result = validate(validEnv);

    expect(result.DATABASE_HOST).toBe('localhost');
    expect(result.DATABASE_PORT).toBe(5432);
    expect(result.DATABASE_USER).toBe('aegis');
    expect(result.DATABASE_PASSWORD).toBe('aegis_dev');
    expect(result.DATABASE_NAME).toBe('aegis');
    expect(result.REDIS_HOST).toBe('localhost');
    expect(result.REDIS_PORT).toBe(6379);
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
  });

  it('should pass with optional fields using defaults', () => {
    const minimalEnv = {
      DATABASE_HOST: 'localhost',
      DATABASE_USER: 'aegis',
      DATABASE_PASSWORD: 'aegis_dev',
      DATABASE_NAME: 'aegis',
      NODE_ENV: 'development',
    };

    const result = validate(minimalEnv);

    expect(result.DATABASE_PORT).toBe(5432);
    expect(result.REDIS_HOST).toBe('localhost');
    expect(result.REDIS_PORT).toBe(6379);
    expect(result.PORT).toBe(3000);
  });

  it('should fail when DATABASE_HOST is missing', () => {
    const { DATABASE_HOST: _, ...envWithout } = validEnv;

    expect(() => validate(envWithout)).toThrow();
  });

  it('should fail when DATABASE_USER is missing', () => {
    const { DATABASE_USER: _, ...envWithout } = validEnv;

    expect(() => validate(envWithout)).toThrow();
  });

  it('should fail when DATABASE_PASSWORD is missing', () => {
    const { DATABASE_PASSWORD: _, ...envWithout } = validEnv;

    expect(() => validate(envWithout)).toThrow();
  });

  it('should fail when DATABASE_NAME is missing', () => {
    const { DATABASE_NAME: _, ...envWithout } = validEnv;

    expect(() => validate(envWithout)).toThrow();
  });

  it('should fail when NODE_ENV has invalid value', () => {
    const invalidEnv = { ...validEnv, NODE_ENV: 'invalid' };

    expect(() => validate(invalidEnv)).toThrow();
  });

  it('should accept all valid NODE_ENV values', () => {
    for (const env of ['development', 'staging', 'production']) {
      const result = validate({ ...validEnv, NODE_ENV: env });
      expect(result.NODE_ENV).toBe(env);
    }
  });
});
