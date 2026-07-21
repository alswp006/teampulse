# Shared Context (auto-generated — do NOT modify)


## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
// ─── Domain Entities ────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  teamId: string;
  teamName: string;
  nickname: string;
  joinedAt: number;
}
export const UserProfile = {} as const;

export type MissionType = "hobby" | "praise" | "worry" | "custom";
export const MissionType = {} as const;

export interface Mission {
  missionId: string;
  teamId: string;
  date: string;
  type: MissionType;
  title: string;
  prompt: string;
  anonymous: boolean;
  aiRecommended: boolean;
}
export const Mission = {} as const;

export interface MissionResponse {
  responseId: string;
  missionId: string;
  userId: string;
  nickname: string;
  content: string;
  anonymous: boolean;
  reactions: number;
  createdAt: number;
}
export const MissionResponse = {} as const;

export type BadgeId = "streak7" | "first_responder" | "top_praise" | "perfect_week";
export const BadgeId = {} as const;

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  participationCount: number;
  streak: number;
  badges: BadgeId[];
  rank: number;
}
export const LeaderboardEntry = {} as const;

export interface WeeklyReport {
  teamId: string;
  weekStart: string;
  participationRate: number;
  moodScore: number;
  moodTrend: number[];
  positiveKeywords: string[];
  summary: string;
  generatedByAI: true;
}
export const WeeklyReport = {} as const;

// ─── API Request/Response Types ────────────────────────────────────────────

export interface JoinRequest {
  teamCode: string;
  nickname: string;
}
export const JoinRequest = {} as const;

export interface JoinResponse {
  userId: string;
  teamId: string;
  teamName: string;
}
export const JoinResponse = {} as const;

export interface CreateResponseRequest {
  content: string;
  anonymous: boolean;
}
export const CreateResponseRequest = {} as const;

export interface RecommendResponse {
  mission: Mission;
  moodScore: number;
  rationale: string;
}
export const RecommendResponse = {} as const;

export interface FeedResponse {
  responses: MissionResponse[];
}
export const FeedResponse = {} as const;

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  myRank: number;
}
export const LeaderboardResponse = {} as const;

// ─── Standard Error Type ────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}
export const ApiError = {} as const;

// ─── Route State ────────────────────────────────────────────────────────────

export type RouteState = {
  "/onboarding": undefined;
  "/": { fromOnboarding?: boolean } | undefined;
  "/feed": { missionId: string };
  "/leaderboard": undefined;
  "/report": undefined;
};
export const RouteState = {} as const;

// ─── Cache / Local Storage Key Helpers ─────────────────────────────────────

export const cacheKeys = {
  mission: (date: string) => `teampulse:cache:mission:${date}`,
  feed: (missionId: string) => `teampulse:cache:feed:${missionId}`,
  lea
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    api/
    apiClient.ts
    profileContext.tsx
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Feed.tsx
    Home.tsx
    Onboarding.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- api/endpoints.ts: export async function joinTeam(teamCode: string, nickname: string): Promise<JoinResponse>; export async function fetchTodayMission(teamId: string): Promise<Mission | null | any>; export async function createResponse( missionId: string, content: string, anonymous: boolean, ): Promise<MissionResponse; export async function recommendMission(teamId: string): Promise<RecommendResponse>; export async function fetchFeed( teamId: string, missionId?: string, ): Promise<MissionResponse[] |; export async function reactToResponse( responseId: string, ): Promise<; export async function fetchLeaderboard( teamId: string, ): Promise<LeaderboardResponse |; export async function fetchWeeklyReport(teamId: string): Promise<WeeklyReport | null | any>
- apiClient.ts: export type FetchOptions = RequestInit; export async function apiFetch<T = unknown>(path: string, opts: FetchOptions =; export async function withCacheFallback<T>( fetcher: () => Promise<T>, cacheKey: string, ): Promise<T |
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void; export function getProfile(): UserProfile | null; export function setProfile(profile: UserProfile): void; export function clearProfile(): void; export function readCache<T>(key: string): T | null; export function writeCache<T>(key: string, value: T): void
- types.ts: export interface UserProfile; export const UserProfile =; export type MissionType = "hobby" | "praise" | "worry" | "custom"; export const MissionType =; export interface Mission; export const Mission =; export interface MissionResponse; export const MissionResponse =
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd

### Module Dependencies (import graph)
  lib/apiClient.ts → imports: lib/storage
  lib/storage.ts → imports: lib/types, lib/types
  pages/Feed.tsx → imports: components/ScreenScaffold, components/StateView, lib/api/endpoints, lib/profileContext, lib/types
  pages/Home.tsx → imports: components/ScreenScaffold, components/SummaryHero, components/StateView, lib/api/endpoints, lib/profileContext, lib/types
  pages/Onboarding.tsx → imports: components/ScreenScaffold, components/BottomCTA, lib/api/endpoints, lib/profileContext
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: TypeScript 타입 + RouteState + 캐시 키 상수 (files: src/lib/types.ts)
- 0002: localStorage 헬퍼 (프로필·캐시·draft·플래그) (files: src/lib/storage.ts)
- 0003: ProfileContext + AI 고지 상태 관리 (files: src/lib/profileContext.tsx)
- 0004: fetch 래퍼 + 타임아웃 + 표준 에러 + 캐시 폴백 (files: src/lib/apiClient.ts)
- 0005: 엔드포인트 함수 모음 (files: src/lib/api/endpoints.ts)
- 0006: 온보딩 페이지 /onboarding (files: src/pages/Onboarding.tsx)
- 0007: 홈/오늘의 미션 표시 + 상태 컨테이너 / (files: src/pages/Home.tsx)
- 0010: 팀 피드 페이지 /feed (files: src/pages/Feed.tsx)
- 0008: 오늘의 미션 응답 폼 모듈 (입력·검증·draft·제출) (files: src/pages/home/ResponseForm.tsx, src/pages/Home.tsx)