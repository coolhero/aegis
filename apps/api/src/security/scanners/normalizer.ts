import { Injectable } from '@nestjs/common';

@Injectable()
export class InputNormalizer {
  normalize(input: string): string {
    let result = input;
    result = this.decodeBase64Segments(result);
    result = this.normalizeUnicode(result);
    result = this.decodeHtmlEntities(result);
    return result;
  }

  private decodeBase64Segments(input: string): string {
    // Match potential base64 strings (20+ chars, valid base64 charset)
    const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
    return input.replace(base64Pattern, (match) => {
      try {
        const decoded = Buffer.from(match, 'base64').toString('utf-8');
        // Verify it decoded to readable text (not binary)
        if (/^[\x20-\x7E\s]+$/.test(decoded) && decoded.length >= 4) {
          return decoded;
        }
        return match;
      } catch {
        return match;
      }
    });
  }

  private normalizeUnicode(input: string): string {
    // NFKC normalization — converts homoglyphs to canonical forms
    return input.normalize('NFKC');
  }

  private decodeHtmlEntities(input: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
    };

    let result = input;

    // Named entities
    for (const [entity, char] of Object.entries(entities)) {
      result = result.split(entity).join(char);
    }

    // Numeric entities (decimal)
    result = result.replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 10)),
    );

    // Numeric entities (hex)
    result = result.replace(/&#x([0-9A-Fa-f]+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    );

    return result;
  }
}
