# SPEC — TeamPulse

비동기 마이크로 팀빌딩 플랫폼 (앱인토스 / Vite + React + TypeScript + TDS)

---

## Common Principles

- **인증**: 토스가 세션을 자동 제공. 별도 로그인 함수 호출 없음. 앱 진입 시 `getIsTossLoginIntegratedService()`로 연동 상태만 확인하고, 서버 유저 식별은 팀 참여 시 발급받은 `userId`(localStorage 저장)로 수행.
- **데이터 계층**: 팀 공유 데이터(미션·응답·리더보드·리포트)는 **외부 API 서버**(Railway 별도 배포)에 저장. 기기 로컬 데이터(내 프로필, AI 고지 확인 플래그, 입력 임시저장, 응답 캐시)만 localStorage 사용. 서버 응답은 항상 캐시하여 오프라인/로딩 시 폴백.
- **AI 고지 의무**: 미션 추천, 분위기 분석, 주간 리포트가 생성형 AI 결과물이므로 (1) 서비스 첫 이용 시 "이 서비스는 생성형 AI를 활용합니다" 다이얼로그 1회, (2) 모든 AI 결과물에 "AI가 생성한 결과입니다" 배지를 표시.
- **UI**: 모든 화면은 TDS 컴포넌트로 조립. 여백은 TDS `Spacing`(size 필수)만 사용. 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트 기본값만 사용(HEX 하드코딩 금지, 다크모드 지원). 하단 탭은 템플릿 `src/components/FloatingTabBar` 사용.
- **모바일**: 모든 터치 타깃 ≥ 44px. 폼은 모바일 키보드(포커스 시 스크롤, `enterkeyhint`, 제출 후 키보드 dismiss) 처리. 긴 목록은 가상 스크롤.
- **검수**: 프로덕션 빌드에서 `console.error` 0개, 외부 API는 CORS 완료, 외부 도메인 이탈/외부 분석 솔루션/앱 설치 유도 금지. Android 7+/iOS 16+ 호환.
- **에러 표준 응답**: 모든 API 에러는 `{ error: string }` 형태.

---

## Data Models

### UserProfile — 로컬 저장, 내 프로필
| field | type | constraints |
|---|---|---|
| userId | string | 서버 발급 UUID, 필수 |
| teamId | string | 필수 |
| teamName | string | 1~30자 |
| nickname | string | 1~12자, 공백만 불가 |
| joinedAt | number | epoch ms |

```ts
interface UserProfile {
  userId: string;
  teamId: string;
  teamName: string;
  nickname: string;
  joinedAt: number;
}
```
- localStorage key: `teampulse:profile` → 단일 객체(JSON). 크기 ≈ 0.2KB.

### Mission — 오늘의 미션 (서버 소스, 로컬 캐시)
```ts
type MissionType = 'hobby' | 'praise' | 'worry' | 'custom';
interface Mission {
  missionId: string;
  teamId: string;
  date: string;            // 'YYYY-MM-DD'
  type: MissionType;
  title: string;           // 예: "요즘 빠진 취미 공유하기"
  prompt: string;          // 응답 안내 문구
  anonymous: boolean;      // worry 타입은 true
  aiRecommended: boolean;  // AI 추천 여부
}
```
- localStorage cache key: `teampulse:cache:mission:<date>` → 단일 객체. ≈ 0.4KB.

### MissionResponse — 미션 응답
```ts
interface MissionResponse {
  responseId: string;
  missionId: string;
  userId: string;
  nickname: string;        // anonymous면 "익명"
  content: string;         // 1~300자
  anonymous: boolean;
  reactions: number;       // 칭찬/공감 수, ≥0
  createdAt: number;       // epoch ms
}
```
- localStorage cache key: `teampulse:cache:feed:<missionId>` → `MissionResponse[]`. 팀 50명 × 0.3KB ≈ 15KB/미션.
- draft key: `teampulse:draft:<missionId>` → `{ content: string }`. ≈ 0.3KB.

### LeaderboardEntry — 리더보드/배지
```ts
type BadgeId = 'streak7' | 'first_responder' | 'top_praise' | 'perfect_week';
interface LeaderboardEntry {
  userId: string;
  nickname: string;
  participationCount: number; // ≥0
  streak: number;             // 연속 참여 일수 ≥0
  badges: BadgeId[];
  rank: number;               // 1부터
}
```
- localStorage cache key: `teampulse:cache:leaderboard:<teamId>` → `LeaderboardEntry[]`. 50명 ≈ 10KB.

### WeeklyReport — 주간 팀 리포트 (AI 생성)
```ts
interface WeeklyReport {
  teamId: string;
  weekStart: string;          // 'YYYY-MM-DD' (월요일)
  participationRate: number;  // 0~100
  moodScore: number;          // 0~100
  moodTrend: number[];        // 최근 7일 분위기 점수 배열, 길이 7
  positiveKeywords: string[]; // 최대 8개
  summary: string;            // AI 요약, ≤500자
  generatedByAI: true;
}
```
- localStorage cache key: `teampulse:cache:report:<weekStart>` → 단일 객체. ≈ 1KB.

### 로컬 플래그
- `teampulse:ai_notice_ack` → `"true"` (AI 첫 이용 고지 확인). ≈ 10B.

**총 localStorage 사용량 추정**: 프로필+플래그+캐시(미션/피드/리더보드/리포트) 합산 ≈ 40KB, 5MB 한도 대비 안전.

---

## Feature List

### F1. 데이터 계층 & API 클라이언트 (localStorage + 외부 API)

- **Description**: 팀 공유 데이터를 다루는 API 클라이언트와 로컬 캐시/프로필 저장 유틸을 제공한다. 모든 화면이 공통으로 사용하는 기반 계층으로, 네트워크 실패 시 캐시 폴백과 표준 에러 처리를 담당한다.
- **Data**: UserProfile, 모든 캐시 키
- **API**: 아래 API Contract의 공통 클라이언트(`fetch` 래퍼, base = `import.meta.env.VITE_API_BASE_URL`)

**Requirements**
- AC-1 [U][P0]: Scenario: 프로필 로드
  - Given `teampulse:profile`에 `{ userId:"u1", teamId:"t1", teamName:"디자인팀", nickname:"민지", joinedAt:1750000000000 }`가 있을 때
  - When 앱이 시작되면
  - Then `getProfile()`이 위 객체를 반환하고, 없으면 `null`을 반환한다
- AC-2 [E][P0]: Scenario: API 성공 시 캐시 저장
  - Given 서버가 `GET /teams/t1/missions/today`에 200과 미션 객체를 반환할 때
  - When `fetchTodayMission("t1")` 호출
  - Then 응답을 `teampulse:cache:mission:<date>`에 저장하고 미션 객체를 반환한다
- AC-3 [W][P1]: Scenario: 네트워크 실패 시 캐시 폴백
  - Given 서버 요청이 타임아웃(8초) 또는 5xx일 때
  - When `fetchTodayMission("t1")` 호출하고 `teampulse:cache:mission:<date>` 캐시가 존재하면
  - Then 캐시된 미션을 반환하고 `{ stale: true }` 플래그를 함께 반환한다
- AC-4 [W][P1]: Scenario: 캐시도 없고 네트워크 실패
  - Given 캐시가 없고 서버가 5xx를 반환할 때
  - When `fetchTodayMission("t1")` 호출
  - Then `{ error: "네트워크 연결을 확인해주세요" }`를 throw하고 `console.error`는 호출하지 않는다
- AC-5 [W][P1]: Scenario: localStorage 저장 실패(용량 초과)
  - Given `setItem`이 QuotaExceededError를 던질 때
  - When 캐시 저장 시도
  - Then 저장을 건너뛰고 앱은 크래시 없이 메모리 값으로 계속 동작한다
- AC-6 [U][P0]: Scenario: 외부 이탈 차단
  - Given API base URL이 아닌 임의 URL로 이동 요청이 들어올 때
  - When 클라이언트가 요청을 만들면
  - Then `window.location.href`/`window.open` 호출 없이 `fetch`로만 처리하고 외부 도메인 이동을 하지 않는다

---

### F2. 팀 온보딩 (팀 참여 & 프로필)

- **Description**: 최초 진입 유저가 팀 초대 코드와 닉네임을 입력해 팀에 참여한다. 참여 성공 시 서버가 발급한 `userId`와 팀 정보를 localStorage에 저장하고 홈으로 이동한다.
- **Data**: UserProfile
- **API**: `POST /teams/join { teamCode, nickname } → { userId, teamId, teamName }`

**Requirements**
- AC-1 [E][P0]: Scenario: 팀 참여 성공
  - Given 프로필이 없는 유저가 온보딩 화면에 있을 때
  - When `{ teamCode: "PULSE24", nickname: "민지" }`로 참여 제출
  - Then 서버가 `{ userId:"u1", teamId:"t1", teamName:"디자인팀" }` 반환 시 `teampulse:profile`에 저장하고 성공 토스트 "디자인팀에 참여했어요"를 표시한 뒤 `navigate('/')` 한다
- AC-2 [W][P1]: Scenario: 닉네임 미입력 거부
  - Given 온보딩 화면일 때
  - When `{ teamCode: "PULSE24", nickname: "" }` 제출
  - Then 에러 메시지 "닉네임을 입력해주세요"를 TextField 하단에 표시하고 API를 호출하지 않는다
- AC-3 [W][P1]: Scenario: 잘못된 팀 코드
  - Given 온보딩 화면일 때
  - When `{ teamCode: "WRONG", nickname: "민지" }` 제출하고 서버가 404 `{ error: "존재하지 않는 팀 코드예요" }` 반환
  - Then 해당 에러 메시지를 화면에 표시하고 화면 전환하지 않는다
- AC-4 [S][P1]: Scenario: 제출 중 로딩
  - While 참여 API 응답을 기다리는 동안
  - the system shall 제출 버튼을 로딩 상태(비활성)로 표시하고 중복 제출을 차단한다
- AC-5 [E][P1]: Scenario: 이미 참여한 유저 스킵
  - Given `teampulse:profile`이 이미 존재할 때
  - When 앱 진입
  - Then 온보딩을 건너뛰고 즉시 `/`로 리다이렉트한다
- AC-6 [U][P0]: Scenario: 프로모션 지급 한도 검증
  - Given 신규 팀 초대 프로모션으로 `grantPromotionReward` 호출 시
  - Then `amount ≤ 5000` 검증을 통과한 경우에만 호출하고, 초과 시 호출하지 않는다

---

### F3. 오늘의 미션 참여 (조회 + 응답 제출)

- **Description**: 홈 화면에서 오늘의 팀 미션을 보여주고, 유저가 짧은 응답을 비동기로 제출한다. `worry` 타입 미션은 익명으로 저장되며, 입력 중 내용은 자동 임시저장된다. 앱의 핵심 루프 화면이다.
- **Data**: Mission, MissionResponse, draft
- **API**: `GET /teams/:teamId/missions/today`, `POST /missions/:missionId/responses`

**Requirements**
- AC-1 [E][P0]: Scenario: 응답 제출 성공
  - Given 오늘 미션 `{ missionId:"m1", type:"hobby", anonymous:false }`가 표시될 때
  - When `{ content: "요즘 클라이밍에 빠졌어요" }` 제출
  - Then 서버 저장 후 성공 토스트 "응답을 남겼어요"를 표시하고, `teampulse:draft:m1`을 삭제하며, 화면 상태를 "참여 완료"로 전환한다
- AC-2 [S][P0]: Scenario: 익명 미션
  - While 미션 `type === 'worry'`일 때
  - the system shall 응답을 `anonymous:true`, `nickname:"익명"`으로 제출하고 화면에 "익명으로 등록돼요" 안내를 표시한다
- AC-3 [W][P1]: Scenario: 빈 응답 거부
  - Given 미션 화면일 때
  - When `{ content: "" }` 또는 공백만 제출
  - Then 에러 "내용을 입력해주세요"를 표시하고 API를 호출하지 않는다
- AC-4 [W][P1]: Scenario: 300자 초과 차단
  - Given 응답 입력 중일 때
  - When 301자 이상 입력
  - Then 300자에서 입력을 막고 카운터 "300/300"를 표시한다
- AC-5 [E][P2]: Scenario: 입력 자동 임시저장
  - Given 응답을 입력 중일 때
  - When 텍스트가 변경되면
  - Then `teampulse:draft:m1`에 `{ content }`를 저장하고, 재진입 시 복원한다
- AC-6 [S][P1]: Scenario: 미션 로딩 상태
  - While `GET .../missions/today` 응답 대기 중일 때
  - the system shall Skeleton(TDS) 형태의 로딩 카드를 표시한다
- AC-7 [W][P1]: Scenario: 오늘 미션 없음(빈 상태)
  - Given 서버가 오늘 미션 없음(204)을 반환할 때
  - When 홈 진입
  - Then `Asset.ContentIcon`과 "오늘의 미션이 곧 열려요" 빈 상태를 표시하고 입력 폼을 숨긴다
- AC-8 [S][P1]: Scenario: 중복 참여 방지
  - While 이미 오늘 미션에 응답한 상태일 때
  - the system shall 입력 폼 대신 "이미 참여했어요" 상태와 피드 보기 버튼을 표시한다

---

### F4. AI 미션 추천 & 팀 분위기 분석

- **Description**: 팀 최근 응답의 톤을 AI가 분석해 팀 긴장도에 맞는 미션을 추천한다(긴장도 높으면 가벼운 미션). 추천 결과와 분위기 요약에는 AI 생성 고지가 붙는다.
- **Data**: Mission(aiRecommended:true)
- **API**: `POST /teams/:teamId/missions/recommend → { mission, moodScore, rationale }`

**Requirements**
- AC-1 [E][P0]: Scenario: AI 미션 추천 성공
  - Given 팀장이 홈에서 "AI 추천 미션 받기" 탭할 때
  - When 서버가 `{ mission:{...,aiRecommended:true}, moodScore:42, rationale:"팀 긴장도가 높아 가벼운 미션을 추천해요" }` 반환
  - Then 추천 미션 카드와 `rationale`을 표시하고, 카드에 "AI가 생성한 결과입니다" 배지를 표시한다
- AC-2 [E][P0]: Scenario: AI 첫 이용 고지
  - Given 유저가 AI 기능을 처음 사용할 때
  - When "AI 추천 미션 받기"를 최초로 탭
  - Then "이 서비스는 생성형 AI를 활용합니다" AlertDialog가 1회 표시되고, 확인 탭 시 `teampulse:ai_notice_ack="true"`를 저장한 뒤 요청을 진행한다
- AC-3 [U][P0]: Scenario: AI 결과물 라벨
  - Given AI 추천 미션/분위기 요약이 화면에 표시될 때
  - Then 결과 카드 하단에 "AI가 생성한 결과입니다" 텍스트 배지가 항상 표시된다
- AC-4 [S][P1]: Scenario: AI 생성 로딩
  - While 추천 API 응답 대기 중일 때
  - the system shall 버튼을 로딩 상태로 두고 "팀 분위기를 분석하고 있어요" 메시지를 표시한다
- AC-5 [W][P1]: Scenario: AI 실패 폴백
  - Given 추천 API가 500 또는 타임아웃일 때
  - When 추천 요청
  - Then "지금은 추천을 못 받았어요. 기본 미션을 사용할게요" 토스트를 표시하고 기본 미션 목록으로 폴백한다
- AC-6 [W][P1]: Scenario: 데이터 부족 빈 상태
  - Given 팀 응답이 3건 미만이라 서버가 `{ error:"분석할 데이터가 부족해요" }` 반환
  - When 추천 요청
  - Then 해당 안내를 표시하고 배지 없이 기본 미션 제안만 노출한다

---

### F5. 팀 피드 (응답 모아보기)

- **Description**: 오늘/과거 미션에 대한 팀원들의 응답을 목록으로 보여주고, 각 응답에 공감(칭찬) 리액션을 남길 수 있다. 익명 미션의 응답은 작성자 없이 표시된다.
- **Data**: MissionResponse
- **API**: `GET /teams/:teamId/feed?missionId=`, `POST /responses/:responseId/react`

**Requirements**
- AC-1 [U][P0]: Scenario: 피드 목록 표시
  - Given 미션 `m1`에 응답 12건이 있을 때
  - When 피드 화면 진입
  - Then 각 응답을 TDS ListRow로 최신순 표시하고, 익명 응답은 작성자명 자리에 "익명"을 표시한다
- AC-2 [E][P0]: Scenario: 공감 리액션
  - Given 응답 `r1`(reactions:3)이 표시될 때
  - When 공감 버튼 탭
  - Then 서버 저장 후 카운트를 4로 즉시 반영(낙관적 업데이트)한다
- AC-3 [W][P1]: Scenario: 리액션 실패 롤백
  - Given 공감 API가 실패할 때
  - When 리액션 탭 후 실패 응답 수신
  - Then 카운트를 원래 값으로 롤백하고 "잠시 후 다시 시도해주세요" 토스트를 표시한다
- AC-4 [S][P1]: Scenario: 피드 로딩
  - While 피드 API 응답 대기 중일 때
  - the system shall 3개의 Skeleton ListRow를 표시한다
- AC-5 [W][P1]: Scenario: 빈 피드
  - Given 미션에 응답이 0건일 때
  - When 피드 진입
  - Then `Asset.ContentIcon`과 "아직 응답이 없어요. 첫 응답을 남겨보세요" 빈 상태를 표시한다
- AC-6 [U][P1]: Scenario: 긴 목록 가상 스크롤
  - Given 응답이 50건 이상일 때
  - the system shall 가상 스크롤로 렌더하여 스크롤 프레임 드롭 없이 표시한다

---

### F6. 리더보드 & 배지 (게이미피케이션)

- **Description**: 팀원별 참여 횟수·연속 참여(streak) 기반 랭킹과 획득 배지를 보여준다. 내 순위는 상단에 고정 강조된다. 데이터 화면으로 지표 시각화를 포함한다.
- **Data**: LeaderboardEntry
- **API**: `GET /teams/:teamId/leaderboard → { entries, myRank }`

**Requirements**
- AC-1 [U][P0]: Scenario: 리더보드 표시
  - Given 팀원 20명 데이터가 있을 때
  - When 리더보드 진입
  - Then `participationCount` 내림차순으로 순위를 매겨 ListRow로 표시하고, 각 행에 참여 횟수와 streak을 표시한다
- AC-2 [U][P0]: Scenario: 내 순위 강조
  - Given `myRank:5`일 때
  - When 리더보드 진입
  - Then 상단 SummaryHero에 내 순위 "5위"를 CountUp으로 강조 표시한다
- AC-3 [E][P2]: Scenario: 배지 상세
  - Given 내가 `streak7` 배지를 보유할 때
  - When 배지 Chip 탭
  - Then BottomSheet로 "7일 연속 참여" 설명을 표시한다
- AC-4 [S][P1]: Scenario: 리더보드 로딩
  - While 리더보드 API 대기 중일 때
  - the system shall Skeleton 목록을 표시한다
- AC-5 [W][P1]: Scenario: 빈 리더보드
  - Given 아직 참여 기록이 0건일 때
  - When 진입
  - Then "이번 주 참여 기록이 없어요" 빈 상태를 표시한다
- AC-6 [W][P1]: Scenario: 캐시 폴백 표시
  - Given 리더보드 API 실패 & 캐시 존재
  - When 진입
  - Then 캐시 데이터를 표시하고 상단에 "최신 정보가 아닐 수 있어요" Chip을 노출한다

---

### F7. 주간 팀 리포트 (AI, 보상형 광고 게이트)

- **Description**: 지난 주 참여율·팀 분위기 점수·긍정 키워드·AI 요약을 리포트로 제공한다. 리포트는 AI 생성물이므로 고지 배지를 붙이고, 결과 확인 전 보상형 광고를 시청하도록 게이트한다.
- **Data**: WeeklyReport
- **API**: `GET /teams/:teamId/report/weekly → { report }`

**Requirements**
- AC-1 [E][P0]: Scenario: 결과 보기 전 보상형 광고
  - Given 유저가 리포트 화면에서 "이번 주 리포트 보기" 탭할 때
  - When `TossRewardAd` 광고 시청이 완료되면
  - Then 주간 리포트 카드가 표시된다
- AC-2 [U][P0]: Scenario: 리포트 지표 표시
  - Given 리포트 `{ participationRate:82, moodScore:74, moodTrend:[60,65,70,68,72,74,74], positiveKeywords:["칭찬","협업"] }`일 때
  - When 리포트 표시
  - Then 참여율/분위기 점수를 SummaryHero CountUp으로, `moodTrend`를 Sparkline으로 시각화한다
- AC-3 [U][P0]: Scenario: AI 라벨
  - Given AI 요약(`summary`)이 표시될 때
  - Then 리포트 카드 하단에 "AI가 생성한 결과입니다" 배지를 항상 표시한다
- AC-4 [S][P1]: Scenario: 리포트 로딩
  - While 리포트 API 대기 중일 때
  - the system shall Skeleton 카드를 표시한다
- AC-5 [W][P1]: Scenario: 리포트 미생성
  - Given 지난 주 데이터가 없어 서버가 204를 반환할 때
  - When 리포트 진입
  - Then "이번 주 리포트가 아직 준비되지 않았어요" 빈 상태를 표시한다
- AC-6 [W][P1]: Scenario: 광고 시청 중단
  - Given 유저가 보상형 광고를 끝까지 보지 않고 닫을 때
  - When 광고 종료
  - Then 리포트를 표시하지 않고 "광고를 끝까지 보면 리포트를 볼 수 있어요" 토스트를 표시한다

---

## Screen Definitions

### S1. 온보딩 — `/onboarding`
- **TDS 컴포넌트**: `Top`(타이틀), `TextField`(팀 코드), `TextField`(닉네임), `Button`(참여, display="block" 하단 고정 SubmitFooter), `Toast`, `Spacing`
- **레이아웃 계약**: `ScreenScaffold`로 감싸고, 1차 액션은 하단 고정 `SubmitFooter`의 `display="block"` 버튼. raw div 골격 금지.
- **상태**: Loading(제출 중 버튼 비활성) / Empty(해당 없음) / Error(TextField 하단 에러 메시지)
- **터치**: 모든 입력·버튼 ≥ 44px, 포커스 시 키보드 위로 폼 스크롤
- **네비게이션 계약**:
  - Outgoing: 참여 성공 → `navigate('/', { replace: true })` (state 없음)
  - Incoming: `location.state = undefined`

### S2. 홈 / 오늘의 미션 — `/`
- **TDS 컴포넌트**: `Top`, `Card`(미션), `Paragraph.Text`(prompt), `TextField`(응답, 멀티라인), `Chip`(글자수/익명 안내), `Button`(제출, SubmitFooter), `Button`(AI 추천), `AlertDialog`(AI 고지), `Skeleton`, `Toast`, `Asset.ContentIcon`(빈 상태), `AdSlot`
- **레이아웃 계약**: `ScreenScaffold`. 미션은 `Card`로 위계 표현, 제목은 t2~t3 강조. 광고 배너 `AdSlot`은 미션 카드와 입력 폼 사이 섹션 경계에 배치(콘텐츠 비중첩). 하단 응답 제출은 `SubmitFooter`.
- **레이아웃 AC**: AC-L1 [U]: 홈 화면은 `data-testid="mission-card"` Card 1개와 `data-testid="ai-badge"`(AI 추천 시)를 가진다
- **상태**: Loading(Skeleton 카드) / Empty("오늘의 미션이 곧 열려요") / Error(재시도 버튼) / 참여완료("이미 참여했어요")
- **터치**: 입력·제출·AI 버튼 ≥ 44px, 제출 후 키보드 dismiss
- **네비게이션 계약**:
  - Outgoing: 피드 보기 → `navigate('/feed', { state: { missionId: string } })`
  - Incoming: `location.state = { fromOnboarding?: boolean } | undefined`

### S3. 팀 피드 — `/feed`
- **TDS 컴포넌트**: `Top`, `ListRow`(응답), `Button`/아이콘 버튼(공감), `Skeleton`, `Asset.ContentIcon`(빈 상태), `Toast`
- **레이아웃 계약**: `ScreenScaffold`. 응답은 `ListRow` 나열, 익명은 작성자 자리 "익명". 50건↑ 가상 스크롤.
- **상태**: Loading(Skeleton 3행) / Empty("아직 응답이 없어요") / Error(캐시 폴백 + "최신 정보 아닐 수 있어요" Chip)
- **터치**: 공감 버튼 ≥ 44px
- **네비게이션 계약**:
  - Outgoing: (없음, 뒤로가기)
  - Incoming: `location.state = { missionId: string }` (없으면 오늘 미션 id로 폴백)

### S4. 리더보드 — `/leaderboard`
- **TDS 컴포넌트**: `Top`, `SummaryHero`(내 순위 CountUp), `ListRow`(랭킹), `Chip`(배지), `BottomSheet`(배지 설명), `MiniBar`(참여 비율), `Skeleton`, `Asset.ContentIcon`
- **레이아웃 계약**: `ScreenScaffold`. 상단 내 순위 `SummaryHero` 히어로, 각 행 참여 횟수를 `MiniBar`로 비율 시각화.
- **레이아웃 AC**: AC-L2 [U]: 리더보드 화면은 `data-testid="my-rank-hero"` SummaryHero 1개와 순위 `ListRow` N개를 가진다
- **상태**: Loading(Skeleton) / Empty("참여 기록이 없어요") / Error(캐시 폴백 Chip)
- **터치**: 배지 Chip ≥ 44px
- **네비게이션 계약**: Outgoing 없음 / Incoming `undefined`

### S5. 주간 리포트 — `/report`
- **TDS 컴포넌트**: `Top`, `TossRewardAd`(결과 게이트), `Card`(리포트), `SummaryHero`(참여율·분위기 CountUp), `Sparkline`(moodTrend), `Chip`(긍정 키워드), `Paragraph.Text`(AI 요약), 배지("AI가 생성한 결과입니다"), `Skeleton`, `Asset.ContentIcon`
- **레이아웃 계약**: `ScreenScaffold`. 핵심 지표는 `Card` 묶음 + `SummaryHero` 강조 + `Sparkline` 추이. AI 배지 하단 고정.
- **레이아웃 AC**: AC-L3 [U]: 리포트 화면은 `data-testid="report-card"` Card 1개, `data-testid="mood-sparkline"` Sparkline 1개, `data-testid="ai-badge"` 배지 1개를 가진다
- **상태**: Loading(Skeleton) / Empty("리포트가 준비되지 않았어요") / Error(재시도) / 광고 미완료(토스트)
- **터치**: "리포트 보기" 버튼 ≥ 44px
- **네비게이션 계약**: Outgoing 없음 / Incoming `undefined`

### 공통 네비게이션
- **FloatingTabBar**(템플릿): 홈 `/`, 피드 `/feed`, 리더보드 `/leaderboard`, 리포트 `/report` 4탭. 온보딩(`/onboarding`)에서는 숨김.

---

## API Contract (외부 API 서버 — Railway, base = `VITE_API_BASE_URL`)

모든 에러 응답: `{ error: string }`. 인증 헤더: `X-User-Id`(join 후 발급된 userId, join 요청에는 없음). CORS: 토스 웹뷰 오리진 허용.

### POST /teams/join
```ts
// Request
interface JoinRequest { teamCode: string; nickname: string; }
// Response 200
interface JoinResponse { userId: string; teamId: string; teamName: string; }
```
- Errors: 400 `{ error:"닉네임을 입력해주세요" }`, 404 `{ error:"존재하지 않는 팀 코드예요" }`, 409 `{ error:"이미 사용 중인 닉네임이에요" }`, 500 `{ error:"잠시 후 다시 시도해주세요" }`

### GET /teams/:teamId/missions/today
```ts
// Response 200: Mission | 204 (없음)
```
- Errors: 401 `{ error:"팀 정보를 확인해주세요" }`, 500

### POST /missions/:missionId/responses
```ts
interface CreateResponseRequest { content: string; anonymous: boolean; }
// Response 200: MissionResponse
```
- Errors: 400 `{ error:"내용을 입력해주세요" }`, 409 `{ error:"이미 참여했어요" }`, 500

### POST /teams/:teamId/missions/recommend (AI)
```ts
interface RecommendResponse { mission: Mission; moodScore: number; rationale: string; }
```
- Errors: 422 `{ error:"분석할 데이터가 부족해요" }`, 500 `{ error:"지금은 추천을 못 받았어요" }`

### GET /teams/:teamId/feed?missionId=
```ts
interface FeedResponse { responses: MissionResponse[]; }
```
- Errors: 401, 500

### POST /responses/:responseId/react
```ts
// Response 200: { responseId: string; reactions: number; }
```
- Errors: 404 `{ error:"응답을 찾을 수 없어요" }`, 500

### GET /teams/:teamId/leaderboard
```ts
interface LeaderboardResponse { entries: LeaderboardEntry[]; myRank: number; }
```
- Errors: 401, 500

### GET /teams/:teamId/report/weekly (AI)
```ts
// Response 200: { report: WeeklyReport } | 204 (미생성)
```
- Errors: 401, 500

---

## Assumptions

- 팀 초대 코드는 앱인토스 콘솔이 아닌 TeamPulse 백엔드(관리자/HR)가 발급하며, MVP에서 코드 생성 UI는 범위 밖(외부 관리자에서 발급).
- 토스 세션은 자동 제공되나 서버 유저 식별은 join 시 발급된 `userId`로 대체(토스 고유 식별자 연동은 `getIsTossLoginIntegratedService()` true일 때만 확장).
- AI 미션 추천/분위기 분석/주간 리포트는 백엔드에서 LLM 호출로 생성하며 클라이언트는 결과만 표시(클라이언트에 API 키 노출 없음).
- B2B 구독 결제(팀당 월 99,000원)는 외부 계약/청구로 처리하며 MVP 클라이언트에는 결제 UI 없음. 앱인토스 IAP/보상형 광고는 개인 유저 리텐션 보조 용도로만 사용.
- 분위기 점수(moodScore)·긍정 키워드는 서버 산출값이며 클라이언트는 검증 없이 표시.

## Open Questions

- 팀 규모(10~50명) 상한을 초과하는 팀의 리더보드/피드 페이지네이션 정책(무한 스크롤 vs 주간 리셋)?
- `worry`(익명 고민) 미션의 응답 노출 범위 — 전체 팀원 공개 vs 팀장만? (프라이버시 이슈)
- 보상형 광고 게이트가 B2B 유료 구독 팀에도 적용되는지(유료 팀은 광고 제거?)
- 주간 리포트 생성 기준 요일/타임존(팀별 근무 시차 고려)?
- AI 추천 미션을 팀장만 트리거하는지, 전체 팀원이 트리거 가능한지 권한 모델?