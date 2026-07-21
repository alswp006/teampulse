# Sprint Contract — 배너 광고 + AI 고지 전역 정합

## 만들 항목

| 파일 | 변경 내용 |
|------|---------|
| `src/components/BannerSection.tsx` | AdSlot 배너 컴포넌트 (콘텐츠 섹션 사이에 배치용, try/catch 가드 포함) |
| `src/components/GlobalAINotice.tsx` | AI 첫 이용 고지 다이얼로그 (aiNoticeAck 단일 소스, Home/Report 모두 사용) |
| `src/App.tsx` | GlobalAINotice + 세션 체크 시점에 aiNoticeAck 읽고 렌더 제어 |
| `src/lib/profileContext.tsx` (수정) | aiNoticeAck 상태 추가 (useProfile에서 aiAckDone boolean 제공) |

## 사용할 TypeScript 타입

- `UserProfile` (types.ts) — userId, teamId
- `keys.aiNoticeAck` (types.ts) — localStorage 키 ("teampulse:ai_notice_ack")

## 검증 방법

1. **AdSlot 배치**: Home/Feed/Report 콘텐츠 사이에 배너가 숨겨지거나 콘텐츠와 겹치지 않는가 (BannerSection CSS 테스트)
2. **AI 고지**: AppRoutes 진입 1회만 다이얼로그 렌더 (aiNoticeAck localStorage에 true 저장 후 재진입 시 미표시)
3. **오류 안정성**: try/catch로 AdSlot 호출 감싸기 (SDK가 환경에서 throw 시 silent degrade)
4. **UX 정책**:
   - `pnpm typecheck` 통과
   - `npm run build` console.error 0개 (prod 빌드 검증)
   - 배너/다이얼로그 터치 타깃 44px 이상 (TDS 컴포넌트 사용)

## 절대 금지

- main.tsx 수정
- 배너 마진/패딩 inline 스타일 (TDS Spacing만 사용)
- aiNoticeAck 값을 여러 곳에서 읽음 (profileContext가 단일 소스)
- console.error/warn 남기기 (prod 빌드 검증 실패)
