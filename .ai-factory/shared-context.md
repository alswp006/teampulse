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
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
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
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: TypeScript 타입 + RouteState + 캐시 키 상수 (files: src/lib/types.ts)