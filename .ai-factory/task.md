SPEC 대비 실제 갭을 확인했습니다. 제공된 TASK는 형식 오류를 고쳤고 47개 AC를 모두 매핑하지만, 두 가지 **실제 갭**이 남아 있습니다.

1. **SPEC Common Principles 위반** — "앱 진입 시 `getIsTossLoginIntegratedService()`로 연동 상태 확인"이 SPEC에 명시돼 있으나 TASK는 각주로 "별도 Task 불필요"라 처리 → 진입 로직이 어느 Task에도 배선되지 않음.
2. **Granularity 위반** — Task 3.2가 F3 8개 AC(미션 표시·로딩/204/참여완료 상태·입력폼·300자·익명·draft·제출)를 단일 패킷에 몰아넣어 10분 초과. 한 페이지지만 별도 컴포넌트 파일로 분리해 순차 의존으로 나눠야 함.

아래는 이 두 갭을 반영한 완전한 업데이트 TASK입니다.

---

# TASK — TeamPulse

SPEC을 구현 가능한 작업 단위로 분해했습니다. 각 Task는 1 코딩 세션(10분 이내)에 완료 가능하며, 완료 시점마다 앱은 컴파일 가능한 상태를 유지합니다.

---

## Epic 1. Data Layer (Types → Storage → State)

Risk 평가
- Complexity: Low~Medium
- Risk factors: (1) 페이지 간 `location.state` 형태 불일치로 런타임 에러 → RouteState 미정의. (2) 캐시 키 문자열 오타로 폴백 실패. (3) `QuotaExceededError`로 앱 크래시.
- Mitigation: Task 1.1에서 RouteState·엔티티·캐시 키 상수를 먼저 단일 소스로 확정한 뒤 storage/state가 이를 import하도록 순서를 강제. QuotaExceeded는 Task 1.2 storage 헬퍼에서 try/catch로 흡수해 이후 모든 페이지가 안전하게 소비.

### Task 1.1 TypeScript 타입 + RouteState 정의
- Description: 모든 엔티티 인터페이스(UserProfile, Mission/MissionType, MissionResponse, LeaderboardEntry/BadgeId, WeeklyReport)와 API 요청/응답 타입(JoinRequest/Response, CreateResponseRequest, RecommendResponse, FeedResponse, LeaderboardResponse), 표준 에러 타입 `ApiError = { error: string }`, RouteState 타입, 캐시 키 생성 헬퍼 상수를 순수 타입/상수로 정의. 런타임 로직 없음. RouteState 예시: `{ '/onboarding': undefined; '/': { fromOnboarding?: boolean } | undefined; '/feed': { missionId: string } | undefined; '/leaderboard': undefined; '/report': undefined; }`
- DoD: `tsc --noEmit` 통과. SPEC의 모든 데이터 모델·API Contract 타입이 존재하고 export됨. RouteState가 5개 라우트 모두 포함. 캐시 키 헬퍼(`cacheKeys.mission(date)`, `cacheKeys.feed(missionId)`, `cacheKeys.leaderboard(teamId)`, `cacheKeys.report(weekStart)`, `keys.profile`, `keys.draft(missionId)`, `keys.aiNoticeAck`) 정의.
- Covers: [F1 데이터 모델 기반 — 전 기능 공통 타입 계약]
- Files: [src/lib/types.ts]
- Depends on: none

### Task 1.2 localStorage 헬퍼 (프로필·캐시·draft·플래그 CRUD)
- Description: `getProfile()/setProfile()/clearProfile()`, 제네릭 캐시 `readCache<T>(key)/writeCache<T>(key,val)`, draft `getDraft(missionId)/setDraft/clearDraft`, AI 고지 플래그 `getAiNoticeAck()/setAiNoticeAck()` 구현. `setItem`은 QuotaExceededError를 try/catch로 흡수(저장 스킵, 크래시 없음). JSON 파싱 실패 시 null 반환. `console.error` 미사용.
- DoD: `getProfile()`이 `teampulse:profile` 존재 시 객체, 없으면 `null` 반환(F1-AC1). QuotaExceeded 발생 시 throw 없이 조용히 스킵(F1-AC5). Task 1.1의 캐시 키 헬퍼만 사용(하드코딩 키 없음). 앱 컴파일 유지.
- Covers: [F1-AC1, F1-AC5]
- Files: [src/lib/storage.ts]
- Depends on: Task 1.1

### Task 1.3 상태 관리 (ProfileContext + AI 고지 상태)
- Description: React Context로 `profile`(nullable)·`setProfileAndPersist()`·`aiNoticeAck`·`ackAiNotice()` 제공. 앱 마운트 시 storage에서 프로필/플래그를 로드해 초기화. 온보딩/가드/AI 다이얼로그가 공유하는 단일 상태 소스.
- DoD: `useProfile()` 훅으로 profile 구독 가능. `setProfileAndPersist()` 호출 시 storage와 context 동시 갱신. `ackAiNotice()`가 `teampulse:ai_notice_ack="true"` 저장 + 상태 반영. Provider 없는 트리에서 사용 시 명확한 throw. 컴파일 유지.
- Covers: [F2-AC5, F4-AC2]
- Files: [src/lib/profileContext.tsx]
- Depends on: Task 1.1, Task 1.2

---

## Epic 2. API Client (외부 API — 서버 코드 없음, 클라이언트만)

Risk 평가
- Complexity: Medium
- Risk factors: (1) 8초 타임아웃/5xx 시 무한 로딩 또는 크래시. (2) 외부 도메인 이탈 금지 위반(`window.open`/`location.href`) → 검수 반려. (3) 캐시 폴백 미구현으로 오프라인 빈 화면.
- Mitigation: Task 2.1에서 `AbortController` 타임아웃 + 표준 `{error}` throw + `console.error` 금지를 공통 래퍼 한 곳에 집중. `fetch`만 사용하고 네비게이션 API 미사용을 코드 규약으로 고정. 폴백 로직을 엔드포인트 함수(Task 2.2)에서 재사용.

### Task 2.1 fetch 래퍼 + 타임아웃 + 표준 에러 + 캐시 폴백 유틸
- Description: `apiFetch(path, opts)` 공통 래퍼 구현 — base=`import.meta.env.VITE_API_BASE_URL`, `X-User-Id` 헤더 자동 첨부(join 제외), `AbortController` 8초 타임아웃, 응답이 `{error}`면 그대로 throw, 204는 null 반환. `window.open`/`location.href` 미사용(fetch 전용). `console.error` 미호출. 캐시 폴백 헬퍼 `withCacheFallback(fetcher, cacheKey)` — 성공 시 캐시 저장 후 반환, 네트워크 실패 시 캐시 있으면 `{ data, stale: true }`, 없으면 `{ error }` throw.
- DoD: 200 응답을 캐시에 저장 후 반환(F1-AC2). 5xx/타임아웃 + 캐시 존재 → `stale:true`와 캐시 반환(F1-AC3). 캐시 없음 + 5xx → `{ error:"네트워크 연결을 확인해주세요" }` throw, `console.error` 미호출(F1-AC4). 외부 도메인 이동 코드 부재(F1-AC6).
- Covers: [F1-AC2, F1-AC3, F1-AC4, F1-AC6]
- Files: [src/lib/apiClient.ts]
- Depends on: Task 1.1, Task 1.2

### Task 2.2 엔드포인트 함수 모음
- Description: `joinTeam()`, `fetchTodayMission(teamId)`(캐시 폴백), `createResponse(missionId, body)`, `recommendMission(teamId)`, `fetchFeed(teamId, missionId)`(캐시 폴백), `reactToResponse(responseId)`, `fetchLeaderboard(teamId)`(캐시 폴백), `fetchWeeklyReport(teamId)`(캐시 폴백)를 Task 2.1 래퍼 위에 구현. 각 함수는 API Contract의 타입 시그니처를 준수.
- DoD: 8개 엔드포인트 함수 모두 타입 안전하게 export. 캐시 대상(mission/feed/leaderboard/report)은 `withCacheFallback` 사용. `tsc --noEmit` 통과.
- Covers: [F1-AC2]
- Files: [src/lib/api/endpoints.ts]
- Depends on: Task 2.1

---

## Epic 3. UI Pages (1 Task = 1 Page/Module)

Risk 평가
- Complexity: Medium~High
- Risk factors: (1) TDS 여백을 Tailwind/인라인으로 덮어써 검수 반려. (2) `location.state` 캐스팅 누락으로 undefined 접근. (3) 낙관적 업데이트 롤백 누락. (4) HEX 하드코딩/44px 미만 터치 타깃. (5) 홈 미션 페이지가 표시+입력+제출을 한 패킷에 몰려 10분 초과.
- Mitigation: 데이터/상태/엔드포인트가 Epic 1~2에서 완성된 뒤 페이지가 소비만 하도록 순서 고정. 홈은 표시(Task 3.2)와 응답폼(Task 3.3)을 **별도 파일**로 분리해 순차 의존으로 배선(동일 파일 병렬 충돌 없음). 각 페이지는 RouteState를 import해 `location.state`를 캐스팅. 모든 UI는 TDS 조립 + `Spacing`(size)만 사용, `var(--tds-color-*)`만 허용.

### Task 3.1 온보딩 페이지 `/onboarding`
- Description: `ScreenScaffold` + `Top` + 팀코드/닉네임 `TextField` + 하단 고정 `SubmitFooter`의 `display="block"` `Button`. `joinTeam()` 호출 → 성공 시 `setProfileAndPersist()` 저장, 성공 `Toast` "OO팀에 참여했어요", `navigate('/', { replace: true })`. 닉네임 공백 검증(비어있으면 API 미호출, TextField 하단 에러). 서버 404 에러 메시지 화면 표시. 제출 중 버튼 로딩/비활성으로 중복 차단. 프로모션 지급 시 `grantPromotionReward({ promotionCode, amount })` 호출 전 `amount ≤ 5000` 검증.
- DoD: F2-AC1~4, AC6 시나리오 동작. 입력·버튼 ≥44px, 포커스 시 폼 스크롤. `console.error` 0개.
- Covers: [F2-AC1, F2-AC2, F2-AC3, F2-AC4, F2-AC6]
- Files: [src/pages/OnboardingPage.tsx]
- Depends on: Task 1.3, Task 2.2

### Task 3.2 홈 / 오늘의 미션 표시 + 상태 페이지 `/` (조회 전용)
- Description: `ScreenScaffold`+`Top`+미션 `Card`(`data-testid="mission-card"`)+`Paragraph.Text`(prompt). `fetchTodayMission` 로드 상태 분기만 담당 — Loading→`Skeleton` 카드, 204→`Asset.ContentIcon` "오늘의 미션이 곧 열려요"(응답폼 슬롯 숨김), 이미 참여완료→"이미 참여했어요" + 피드 보기 버튼(`navigate('/feed', { state: { missionId } })`). 미션 데이터(missionId, type, anonymous 등)를 하위 응답폼 슬롯(Task 3.3 컴포넌트)과 AI 섹션(Task 3.4)에 props로 전달하는 컨테이너 역할. `location.state`는 RouteState로 캐스팅. 응답 입력/제출 로직은 포함하지 않음(Task 3.3).
- DoD: F3-AC1(미션 표시)·F3-AC2(로딩/204/참여완료 상태 전환) 동작. `location.state`를 RouteState로 캐스팅. AC-L1(mission-card testid) 충족. `console.error` 0개.
- Covers: [F3-AC1, F3-AC2, S2-AC-L1]
- Files: [src/pages/HomePage.tsx]
- Depends on: Task 1.3, Task 2.2

### Task 3.3 오늘의 미션 응답 폼 모듈 (입력·검증·draft·제출)
- Description: HomePage가 소비하는 응답 폼 컴포넌트. 멀티라인 `TextField`(응답)+글자수/익명 `Chip`+`SubmitFooter` 제출 버튼. `worry` 타입은 `anonymous:true`+"익명으로 등록돼요" 안내. 빈/공백 응답 거부(제출 비활성). 300자 상한 + "300/300" 카운터. 입력 변경 시 `setDraft(missionId)` 자동 저장, 재진입 시 복원. `createResponse` 제출 성공 시 `Toast` "응답을 남겼어요" + `clearDraft` + HomePage "참여 완료" 상태로 전환 콜백, 제출 후 키보드 dismiss. props로 미션(missionId, type, anonymous) 수신.
- DoD: F3-AC3~AC8 동작(익명 안내·빈값 거부·300자 카운터·draft 저장/복원·제출 성공 토스트·키보드 dismiss). 입력·버튼 ≥44px, 포커스 시 스크롤. `console.error` 0개.
- Covers: [F3-AC3, F3-AC4, F3-AC5, F3-AC6, F3-AC7, F3-AC8]
- Files: [src/pages/home/ResponseForm.tsx]
- Depends on: Task 1.3, Task 2.2, Task 3.2

### Task 3.4 AI 미션 추천 & 분위기 (홈 내 섹션/모듈)
- Description: 홈에 "AI 추천 미션 받기" `Button` + AI 고지 `AlertDialog` + 추천 결과 카드 모듈. 최초 탭 시 `aiNoticeAck` 미확인이면 "이 서비스는 생성형 AI를 활용합니다" `AlertDialog` 1회 → 확인 시 `ackAiNotice()` 저장 후 요청 진행. `recommendMission()` 대기 중 버튼 로딩 + "팀 분위기를 분석하고 있어요". 성공 시 추천 미션 카드 + `rationale` + 하단 "AI가 생성한 결과입니다" 배지(`data-testid="ai-badge"`). 500/타임아웃 → "지금은 추천을 못 받았어요. 기본 미션을 사용할게요" `Toast` + 기본 미션 폴백. 422(데이터 부족) → "분석할 데이터가 부족해요" 안내 + 배지 없이 기본 미션만.
- DoD: F4-AC1~6 동작. AI 배지가 모든 AI 결과물에 항상 표시. AC-L1의 ai-badge testid 충족.
- Covers: [F4-AC1, F4-AC2, F4-AC3, F4-AC4, F4-AC5, F4-AC6]
- Files: [src/pages/home/AiRecommendSection.tsx]
- Depends on: Task 1.3, Task 2.2, Task 3.2

### Task 3.5 팀 피드 페이지 `/feed`
- Description: `ScreenScaffold`+`Top`+응답 `ListRow` 최신순. `location.state.missionId`(RouteState 캐스팅, 없으면 오늘 미션 id 폴백)로 `fetchFeed` 호출. 익명 응답은 작성자 자리 "익명". 공감 아이콘 버튼 탭 시 낙관적 업데이트(+1 즉시 반영) 후 `reactToResponse`, 실패 시 원값 롤백 + "잠시 후 다시 시도해주세요" `Toast`. Loading→`Skeleton` 3행, 응답 0건→`Asset.ContentIcon` "아직 응답이 없어요. 첫 응답을 남겨보세요", 50건↑→가상 스크롤. 캐시 폴백(stale) 시 상단 "최신 정보가 아닐 수 있어요" `Chip`.
- DoD: F5-AC1~6 동작. 공감 버튼 ≥44px. `console.error` 0개.
- Covers: [F5-AC1, F5-AC2, F5-AC3, F5-AC4, F5-AC5, F5-AC6]
- Files: [src/pages/FeedPage.tsx]
- Depends on: Task 1.3, Task 2.2

### Task 3.6 리더보드 페이지 `/leaderboard`
- Description: `ScreenScaffold`+`Top`+상단 `SummaryHero`(`data-testid="my-rank-hero"`, 내 순위 CountUp)+랭킹 `ListRow` N개(참여 횟수·streak, `MiniBar` 비율). `fetchLeaderboard`로 `participationCount` 내림차순 정렬. 배지 `Chip` 탭 시 `BottomSheet`로 설명(예: streak7→"7일 연속 참여"). Loading→`Skeleton`, 참여 0건→`Asset.ContentIcon` "이번 주 참여 기록이 없어요", 캐시 폴백 시 "최신 정보가 아닐 수 있어요" `Chip`.
- DoD: F6-AC1~6 동작. AC-L2(my-rank-hero testid + ListRow N개) 충족. 배지 Chip ≥44px.
- Covers: [F6-AC1, F6-AC2, F6-AC3, F6-AC4, F6-AC5, F6-AC6, S4-AC-L2]
- Files: [src/pages/LeaderboardPage.tsx]
- Depends on: Task 1.3, Task 2.2

### Task 3.7 주간 리포트 페이지 `/report` (보상형 광고 게이트)
- Description: `ScreenScaffold`+`Top`. "이번 주 리포트 보기" 트리거를 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`로 게이트 — 광고 완료 시에만 리포트 `Card`(`data-testid="report-card"`) 노출. 광고 끝까지 안 봄/닫음 → 리포트 미표시 + "광고를 끝까지 보면 리포트를 볼 수 있어요" `Toast`. 리포트가 생성형 AI 결과물이므로 표시 직전 `aiNoticeAck` 미확인이면 "이 서비스는 생성형 AI를 활용합니다" `AlertDialog` 1회 → `ackAiNotice()` 후 진행(홈 AI 섹션과 동일한 전역 상태 소스 공유). 리포트 표시: 참여율·분위기 `SummaryHero` CountUp, `moodTrend` `Sparkline`(`data-testid="mood-sparkline"`), 긍정 키워드 `Chip`, AI 요약 `Paragraph.Text` + 하단 "AI가 생성한 결과입니다" 배지(`data-testid="ai-badge"`). Loading→`Skeleton`, 204→`Asset.ContentIcon` "이번 주 리포트가 아직 준비되지 않았어요".
- DoD: F7-AC1~6 동작. AC-L3(report-card + mood-sparkline + ai-badge testid) 충족. "리포트 보기" 버튼 ≥44px. 리포트 진입 시에도 AI 고지가 앱 생애주기 1회만 발생.
- Covers: [F7-AC1, F7-AC2, F7-AC3, F7-AC4, F7-AC5, F7-AC6, S5-AC-L3]
- Files: [src/pages/ReportPage.tsx]
- Depends on: Task 1.3, Task 2.2

---

## Epic 4. Integration + Landing (Routing · 가드 · 광고 배치 · 세션 연동 확인)

Risk 평가
- Complexity: Low~Medium
- Risk factors: (1) 이미 참여한 유저에게 온보딩 재노출. (2) 온보딩에서 FloatingTabBar 노출. (3) 배너 광고가 콘텐츠와 중첩되어 검수 반려. (4) 프로덕션 `console.error` 잔존. (5) SPEC 필수인 `getIsTossLoginIntegratedService()` 앱 진입 확인 미배선.
- Mitigation: 모든 페이지 완성 후 마지막에 라우팅/가드/탭바/세션 연동 확인/광고 배치를 배선해 회귀 위험 최소화. Provider·가드는 Epic 1의 ProfileContext를 재사용.

### Task 4.1 라우터 배선 + 온보딩 가드 + FloatingTabBar + Toss 세션 연동 확인
- Description: `react-router-dom` 라우트 설정(`/onboarding`, `/`, `/feed`, `/leaderboard`, `/report`), 앱 루트를 `ProfileProvider`로 감싸기. 앱 진입 시 SPEC Common Principles에 따라 `getIsTossLoginIntegratedService()`를 1회 호출해 연동 상태만 확인(연동 여부를 context/상태로 보관, 미연동이어도 join 발급 `userId` 식별로 정상 진행 — 크래시/차단 없음). 진입 가드: `profile` 존재 시 `/onboarding` 접근을 `/`로 즉시 redirect, `profile` 없으면 다른 모든 라우트를 `/onboarding`으로 redirect. 템플릿 `src/components/FloatingTabBar`를 4탭(홈/피드/리더보드/리포트)으로 배선하되 `/onboarding`에서는 숨김. `location.state` 타입은 RouteState 준수.
- DoD: F2-AC5(프로필 존재 시 온보딩 스킵→`/` redirect) 동작. `getIsTossLoginIntegratedService()`가 앱 진입 시 1회 호출되고 반환값 예외 시에도 앱이 정상 렌더(throw로 크래시 없음). 온보딩에서 탭바 미표시. `location.state` 타입은 RouteState 준수. 컴파일·라우팅 정상.
- Covers: [F2-AC5, SPEC-CommonPrinciples: 세션 연동 확인]
- Files: [src/App.tsx, src/routes.tsx]
- Depends on: Task 3.1, Task 3.2, Task 3.3, Task 3.4, Task 3.5, Task 3.6, Task 3.7

### Task 4.2 배너 광고 배치 + AI 첫 이용 고지 전역 정합 + 최종 UX 폴리시
- Description: 홈 화면 미션 카드와 응답 폼 사이 섹션 경계에 `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` 배치(콘텐츠 비중첩). AI 고지 상태(`aiNoticeAck`)가 홈 AI 추천(Task 3.4)과 리포트(Task 3.7) 등 모든 AI 진입점에서 동일 상태 소스를 통해 일관되게 1회만 뜨는지 정합 확인. 프로덕션 빌드 기준 `console.error` 0개 점검, 모든 터치 타깃 ≥44px·HEX 하드코딩 부재·다크모드(var(--tds-color-*)) 최종 확인.
- DoD: 배너가 미션 카드/응답 폼과 겹치지 않음. AI 고지 다이얼로그 앱 생애주기 1회(홈·리포트 어느 경로로 진입해도 중복 노출 없음). `npm run build` 후 `console.error` 0개, 검수 규칙(TDS 여백·색상·44px) 위반 없음.
- Covers: [F4-AC3]
- Files: [src/pages/HomePage.tsx, src/lib/profileContext.tsx]
- Depends on: Task 4.1

---

## AC Coverage

- Total ACs in SPEC: 47 (F1:6 · F2:6 · F3:8 · F4:6 · F5:6 · F6:6 · F7:6 = 44 기능 AC + 레이아웃 AC-L1/L2/L3 = 3)
- Covered by tasks: 47
  - F1: AC1(Task 1.2), AC2(Task 2.1), AC3(Task 2.1), AC4(Task 2.1), AC5(Task 1.2), AC6(Task 2.1)
  - F2: AC1(Task 3.1), AC2(Task 3.1), AC3(Task 3.1), AC4(Task 3.1), AC5(Task 4.1), AC6(Task 3.1)
  - F3: AC1·AC2(Task 3.2), AC3~AC8(Task 3.3)
  - F4: AC1~AC6(Task 3.4), AC3 전역 정합(Task 4.2)
  - F5: AC1~AC6(Task 3.5)
  - F6: AC1~AC6(Task 3.6)
  - F7: AC1~AC6(Task 3.7)
  - Layout: AC-L1(Task 3.2/3.4), AC-L2(Task 3.6), AC-L3(Task 3.7)
- Uncovered: 0

추가 정합 항목
- SPEC Common Principles "앱 진입 시 `getIsTossLoginIntegratedService()` 연동 상태 확인" → Task 4.1에 명시 배선(이전 버전은 각주로만 처리해 어느 Task에도 미배선이었던 갭 해소).
- Task 1.1(types+RouteState)·1.3(state)은 직접 사용자향 AC를 커버하지 않는 기반 계층으로 위 모든 페이지/데이터 AC의 타입·상태 계약을 제공.
- MVP에서 서버 유저 식별은 join 발급 `userId`로 수행하며, `getIsTossLoginIntegratedService()`는 진입 확인·향후 확장 훅으로만 사용(별도 인증 함수 호출 없음).

---

## 변경 요약 (이전 TASK 대비)

- **[SPLIT]** 기존 Task 3.2(F3 8개 AC 단일 패킷) → **3.2 미션 표시/상태**(`HomePage.tsx`) + **3.3 응답 폼 모듈**(`home/ResponseForm.tsx`)로 분리. 별도 파일 + 순차 의존이라 병렬 파일 충돌 없음, 각 10분 이내.
- **[RENUMBER]** AI 추천 3.3→**3.4**, 피드 3.4→**3.5**, 리더보드 3.5→**3.6**, 리포트 3.6→**3.7**. Depends on/Covers 전면 갱신.
- **[ADD]** Task 4.1에 `getIsTossLoginIntegratedService()` 앱 진입 확인 배선(SPEC 필수 항목 갭 해소).
- **[STRENGTHEN]** Task 3.7 리포트에 `aiNoticeAck` 진입 고지 정합 명시 → AI 진입점(홈·리포트) 어디로 들어와도 고지 1회 보장.
- 형식: 모든 필드는 `- DoD:` / `- Covers:` / `- Files:` / `- Depends on:` 평문 불릿, 중첩 코드블록 제거 → 파서 정상 통과.