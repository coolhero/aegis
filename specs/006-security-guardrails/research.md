# Research: Security Guardrails

**Feature**: F006 - Security Guardrails
**Date**: 2026-03-26

## 1. PII Detection Approaches

### Regex-based Detection (선택)
- **장점**: 구현 간단, 예측 가능, 저레이턴시 (<5ms), 의존성 없음
- **단점**: 문맥 미인식 (false positives), 새 패턴 추가 수동
- **적용**: email, phone, SSN, address — 잘 정의된 패턴 유형에 적합

### NER/ML-based Detection (MVP 이후)
- 장점: 문맥 인식, name/address 정확도 향상
- 단점: 모델 로딩 시간, GPU 의존성, 100ms+ 레이턴시
- 적용: name, address 같은 비정형 PII에 향후 적용

### 결정
MVP는 regex 기반. 패턴별 독립 스캐너 클래스로 설계하여 ML 스캐너 교체 용이하게.

## 2. Prompt Injection Defense

### Heuristic Rules (선택)
- 키워드 패턴 매칭: "ignore previous", "system prompt", "reveal instructions" 등
- 정규 표현식 기반 탈옥 패턴 탐지
- OWASP LLM Top 10 기반 알려진 패턴 DB

### ML Classifier (MVP 이후)
- Fine-tuned BERT/distilBERT 분류기
- 정확도 높지만 모델 서빙 인프라 필요

### 결정
MVP는 휴리스틱. 패턴 DB를 파일/DB로 관리하여 무중단 업데이트 가능하게.

## 3. Encoding Bypass Prevention

- Base64 감지: `/^[A-Za-z0-9+/=]{20,}$/` 패턴 매칭 후 디코딩 시도
- Unicode 호모글리프: NFKC 정규화
- HTML 엔티티: `&amp;`, `&#x41;` 등 디코딩
- 순서: 정규화 → 스캐닝 (원본도 병렬 스캔)

## 4. Streaming Output Filtering

### 동기식 필터 파이프라인
- SSE 청크 수신 → 버퍼 추가 → PII 스캔 → 안전 확인 → 클라이언트 전송
- 버퍼 윈도우: 최근 50자 유지 (이메일 최대 길이 기반)
- 완전한 PII 패턴 매칭 후에만 마스킹/전송

### Race Condition 방지
- Observable/Stream Transform 패턴 사용
- 필터 완료 전 클라이언트 전송 차단 (backpressure)

## 5. NestJS Integration Pattern

### Guard vs Interceptor
- **Guard**: 요청 허용/거부 결정. 인젝션 탐지 → reject에 적합
- **Interceptor**: 요청/응답 변환. PII 마스킹, 출력 필터링에 적합

### 결정
- `SecurityGuard`: 인젝션 탐지 (Guard — 요청 전 실행, reject 시 403)
- `GuardInterceptor`: PII 마스킹 + 콘텐츠 필터 (Interceptor — 입출력 변환)
- 실행 순서: Guard(injection) → Controller → Interceptor(PII+content on response)
- 입력 PII는 Interceptor의 request 변환에서 처리

### 정정: NestJS 실행 순서
실제 NestJS 파이프라인:
1. Middleware → 2. Guard → 3. Interceptor(before) → 4. Pipe → 5. Controller → 6. Interceptor(after)

따라서:
- `SecurityGuard`: 인젝션 탐지 → reject
- `GuardInterceptor`: before에서 입력 PII 마스킹, after에서 출력 PII/콘텐츠 필터

## 6. Performance Considerations

- 전체 파이프라인 sub-100ms 목표
- Regex 컴파일: 모듈 초기화 시 한 번만 (캐싱)
- 정규화 + PII 스캔 + 인젝션 스캔 합산 < 100ms
- SecurityPolicy 캐싱: Redis에 org_id 키로 캐시 (TTL 5분)
