# Data Model: F012 — Developer Playground

## 신규 엔티티 없음

F012는 프론트엔드 전용 Feature로, 영속 엔티티를 소유하지 않습니다.
모든 데이터는 세션 내 React state로 관리됩니다.

## 참조 엔티티 (읽기 전용)

| Entity | Owner | 용도 |
|--------|-------|------|
| Provider | F002 | 모델 드롭다운에서 프로바이더 목록 표시 |
| Model | F002 | 모델 목록 + 가격 정보 (input_price_per_token, output_price_per_token) |
| Organization | F003 | 테넌트 컨텍스트 (JWT 기반) |
| User | F003 | 사용자 인증 + 역할 기반 접근 제어 |
| PromptTemplate | F010 | 프롬프트 에디터에서 템플릿 목록 로드 |
| PromptVersion | F010 | 템플릿 버전 내용 표시 |

## 프론트엔드 타입 정의

```typescript
// Playground 세션 데이터 (React state, 영속화 없음)

interface PlaygroundMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PlaygroundParams {
  temperature: number;    // 0-2, step 0.1, default 0.7
  max_tokens: number;     // 1-4096, default 1024
  top_p: number;          // 0-1, step 0.05, default 1.0
}

interface HistoryEntry {
  id: string;             // uuid
  model: string;
  messages: PlaygroundMessage[];
  params: PlaygroundParams;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  responseTimeMs: number;
  timestamp: Date;
}

interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  providerId: string;
  providerName: string;
  inputPricePerToken: number;
  outputPricePerToken: number;
  maxTokens: number;
  enabled: boolean;
}

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  category: string;
  description: string;
  params?: ApiParam[];
  requestBody?: object;
  responseExample?: object;
}

interface ApiParam {
  name: string;
  in: 'path' | 'query' | 'header';
  type: string;
  required: boolean;
  description: string;
}
```
