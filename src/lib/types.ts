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
  leaderboard: (teamId: string) => `teampulse:cache:leaderboard:${teamId}`,
  report: (weekStart: string) => `teampulse:cache:report:${weekStart}`,
} as const;

export const keys = {
  profile: "teampulse:profile",
  draft: (missionId: string) => `teampulse:draft:${missionId}`,
  aiNoticeAck: "teampulse:ai_notice_ack",
} as const;
