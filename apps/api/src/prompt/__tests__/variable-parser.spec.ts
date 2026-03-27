import { VariableParserService } from '../variable-parser.service';
import { BadRequestException } from '@nestjs/common';

describe('VariableParserService', () => {
  let service: VariableParserService;

  beforeEach(() => {
    service = new VariableParserService();
  });

  describe('extract', () => {
    it('should extract simple variables', () => {
      const result = service.extract('Hello {{name}}, welcome to {{place}}!');
      expect(result).toEqual([
        { name: 'name', required: true, default_value: null },
        { name: 'place', required: true, default_value: null },
      ]);
    });

    it('should extract variables with default values', () => {
      const result = service.extract('{{greeting|Hello}} {{name}}');
      expect(result).toEqual([
        { name: 'greeting', required: false, default_value: 'Hello' },
        { name: 'name', required: true, default_value: null },
      ]);
    });

    it('should deduplicate variables', () => {
      const result = service.extract('{{name}} said {{name}}');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('name');
    });

    it('should return empty for no variables', () => {
      expect(service.extract('Plain text')).toEqual([]);
    });

    it('should handle empty default value', () => {
      const result = service.extract('{{lang|}}');
      expect(result[0]).toEqual({ name: 'lang', required: false, default_value: '' });
    });
  });

  describe('resolve', () => {
    it('should substitute variables', () => {
      const result = service.resolve(
        '{{role}}님, {{topic}}에 대해 설명해주세요',
        { role: '전문가', topic: 'AI 보안' },
      );
      expect(result).toBe('전문가님, AI 보안에 대해 설명해주세요');
    });

    it('should use default values when variable not provided', () => {
      const result = service.resolve(
        '{{lang|한국어}}로 답변해주세요',
        {},
      );
      expect(result).toBe('한국어로 답변해주세요');
    });

    it('should throw on missing required variables', () => {
      expect(() =>
        service.resolve('{{name}} {{role}}', { name: 'test' }),
      ).toThrow(BadRequestException);

      try {
        service.resolve('{{name}} {{role}}', { name: 'test' });
      } catch (e: any) {
        expect(e.response.error).toBe('missing_variables');
        expect(e.response.details).toEqual(['role']);
      }
    });

    it('should handle empty string values', () => {
      const result = service.resolve('Hello {{name}}!', { name: '' });
      expect(result).toBe('Hello !');
    });

    it('should override default value with provided value', () => {
      const result = service.resolve('{{lang|한국어}}', { lang: 'English' });
      expect(result).toBe('English');
    });
  });
});
