import { Injectable, BadRequestException } from '@nestjs/common';

export interface VariableMeta {
  name: string;
  required: boolean;
  default_value: string | null;
}

@Injectable()
export class VariableParserService {
  private readonly VARIABLE_REGEX = /\{\{(\w+)(?:\|([^}]*))?\}\}/g;

  extract(content: string): VariableMeta[] {
    const variables: VariableMeta[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    const regex = new RegExp(this.VARIABLE_REGEX.source, 'g');
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);

      const defaultValue = match[2] !== undefined ? match[2] : null;
      variables.push({
        name,
        required: defaultValue === null,
        default_value: defaultValue,
      });
    }

    return variables;
  }

  resolve(
    content: string,
    providedValues: Record<string, string>,
  ): string {
    const variables = this.extract(content);
    const missing: string[] = [];

    for (const v of variables) {
      if (v.required && !(v.name in providedValues)) {
        missing.push(v.name);
      }
    }

    if (missing.length > 0) {
      throw new BadRequestException({
        error: 'missing_variables',
        details: missing,
      });
    }

    return content.replace(
      new RegExp(this.VARIABLE_REGEX.source, 'g'),
      (_match, name, defaultValue) => {
        if (name in providedValues) {
          return providedValues[name];
        }
        return defaultValue ?? '';
      },
    );
  }
}
