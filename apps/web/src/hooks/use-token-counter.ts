// F012 T004: Real-time token counting hook
'use client';

import { useState, useEffect, useRef } from 'react';
import { countTokens } from '@/lib/token-counter';

export function useTokenCounter(text: string, debounceMs = 200) {
  const [tokenCount, setTokenCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setTokenCount(countTokens(text));
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [text, debounceMs]);

  return tokenCount;
}
