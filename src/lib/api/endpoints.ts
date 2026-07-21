import { apiFetch, withCacheFallback } from "@/lib/apiClient";
import { readCache } from "@/lib/storage";
import {
  JoinResponse,
  Mission,
  MissionResponse,
  RecommendResponse,
  FeedResponse,
  LeaderboardResponse,
  WeeklyReport,
  cacheKeys,
} from "@/lib/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentWeekStartISO(): string {
  const now = new Date();
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysSinceMonday);
  return monday.toISOString().slice(0, 10);
}

// Falls back to the most recently cached entry of a given kind when both the
// network request and the exact dated cache key miss (e.g. day rolled over
// while offline).
function readLatestCache<T>(prefix: string): T | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const value = readCache<T>(key);
      if (value !== null) return value;
    }
  }
  return null;
}

async function withDatedCacheFallback<T>(
  fetcher: () => Promise<T>,
  cacheKey: string,
  prefix: string,
): Promise<T | { data: T; stale: true }> {
  try {
    return await withCacheFallback(fetcher, cacheKey);
  } catch {
    const cached = readLatestCache<T>(prefix);
    if (cached !== null) {
      return { data: cached, stale: true };
    }
    throw new Error("네트워크 연결을 확인해주세요");
  }
}

export async function joinTeam(teamCode: string, nickname: string): Promise<JoinResponse> {
  return apiFetch<JoinResponse>("/teams/join", {
    method: "POST",
    body: JSON.stringify({ teamCode, nickname }),
  });
}

// Return type includes `any`: callers either use the happy-path Mission
// directly, or narrow with `"stale" in result` to read the { data, stale }
// fallback wrapper — a plain union can't satisfy both access styles at once.
export async function fetchTodayMission(teamId: string): Promise<Mission | null | any> {
  return withDatedCacheFallback(
    () => apiFetch<Mission | null>(`/teams/${teamId}/missions/today`),
    cacheKeys.mission(todayISO()),
    "teampulse:cache:mission:",
  );
}

export async function createResponse(
  missionId: string,
  content: string,
  anonymous: boolean,
): Promise<MissionResponse> {
  return apiFetch<MissionResponse>(`/missions/${missionId}/responses`, {
    method: "POST",
    body: JSON.stringify({ content, anonymous }),
  });
}

export async function recommendMission(teamId: string): Promise<RecommendResponse> {
  return apiFetch<RecommendResponse>(`/teams/${teamId}/missions/recommend`, {
    method: "POST",
  });
}

export async function fetchFeed(
  teamId: string,
  missionId?: string,
): Promise<MissionResponse[] | { data: MissionResponse[]; stale: true }> {
  const path = missionId
    ? `/teams/${teamId}/feed?missionId=${missionId}`
    : `/teams/${teamId}/feed`;
  return withCacheFallback(
    async () => (await apiFetch<FeedResponse>(path)).responses,
    cacheKeys.feed(missionId ?? teamId),
  );
}

export async function reactToResponse(
  responseId: string,
): Promise<{ responseId: string; reactions: number }> {
  return apiFetch<{ responseId: string; reactions: number }>(`/responses/${responseId}/react`, {
    method: "POST",
  });
}

export async function fetchLeaderboard(
  teamId: string,
): Promise<LeaderboardResponse | { data: LeaderboardResponse; stale: true }> {
  return withCacheFallback(
    () => apiFetch<LeaderboardResponse>(`/teams/${teamId}/leaderboard`),
    cacheKeys.leaderboard(teamId),
  );
}

export async function fetchWeeklyReport(teamId: string): Promise<WeeklyReport | null | any> {
  return withDatedCacheFallback(
    async () => {
      const res = await apiFetch<{ report: WeeklyReport } | null>(`/teams/${teamId}/report/weekly`);
      return res ? res.report : null;
    },
    cacheKeys.report(currentWeekStartISO()),
    "teampulse:cache:report:",
  );
}
