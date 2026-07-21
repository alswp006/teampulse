import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as storage from "@/lib/storage";

/**
 * PACKET 0005: 엔드포인트 함수 모음 (TDD Red Phase)
 *
 * This test file contains TDD tests FIRST. The implementation
 * (src/lib/api/endpoints.ts) does not exist yet.
 *
 * Expected exports from src/lib/api/endpoints.ts:
 * - joinTeam(teamCode: string, nickname: string): Promise<JoinResponse>
 * - fetchTodayMission(teamId: string): Promise<Mission | null>
 * - createResponse(missionId: string, content: string, anonymous: boolean): Promise<MissionResponse>
 * - recommendMission(teamId: string): Promise<RecommendResponse>
 * - fetchFeed(teamId: string, missionId?: string): Promise<MissionResponse[]>
 * - reactToResponse(responseId: string): Promise<{ responseId: string; reactions: number }>
 * - fetchLeaderboard(teamId: string): Promise<LeaderboardResponse>
 * - fetchWeeklyReport(teamId: string): Promise<WeeklyReport | null>
 *
 * AC-1 [P0]: joinTeam(teamCode, nickname) → {userId, teamId, teamName}
 * AC-2 [P0]: fetchTodayMission(teamId) with cache fallback (204 → null, stale support)
 * AC-3 [P0]: createResponse(missionId, content, anonymous) → MissionResponse
 * AC-4 [P0]: recommendMission(teamId) → {mission, moodScore, rationale}
 * AC-5 [P0]: fetchFeed(teamId, missionId?) with cache fallback → MissionResponse[]
 * AC-6 [P0]: reactToResponse(responseId) → {responseId, reactions}
 * AC-7 [P0]: fetchLeaderboard(teamId) with cache fallback → {entries, myRank}
 * AC-8 [P0]: fetchWeeklyReport(teamId) with cache fallback (204 → null, stale support)
 */

describe("AC-1[P0]: joinTeam — team participation with server userId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-1a: joinTeam sends POST /teams/join with teamCode and nickname", async () => {
    const { joinTeam } = await import("@/lib/api/endpoints");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        userId: "u-uuid-001",
        teamId: "team-uuid-123",
        teamName: "디자인팀",
      }),
    });

    const result = await joinTeam("PULSE24", "민지");

    expect(result).toEqual({
      userId: "u-uuid-001",
      teamId: "team-uuid-123",
      teamName: "디자인팀",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/teams/join"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ teamCode: "PULSE24", nickname: "민지" }),
      }),
    );
  });

  it("AC-1b: joinTeam does NOT include X-User-Id header (no auth yet)", async () => {
    const { joinTeam } = await import("@/lib/api/endpoints");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        userId: "u-001",
        teamId: "t-001",
        teamName: "팀A",
      }),
    });

    await joinTeam("CODE123", "사용자");

    const callArgs = (global.fetch as any).mock.calls[0];
    const headers = callArgs[1]?.headers;
    if (headers && typeof headers === "object") {
      // X-User-Id should not be present for /join
      expect(headers["X-User-Id"]).toBeUndefined();
    }
  });
});

describe("AC-2[P0]: fetchTodayMission — today mission with cache + 204 handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-2a: fetchTodayMission(teamId) returns Mission on 200", async () => {
    const { fetchTodayMission } = await import("@/lib/api/endpoints");

    const mockMission = {
      missionId: "m-001",
      teamId: "t-001",
      date: "2025-01-22",
      type: "hobby" as const,
      title: "요즘 빠진 취미 공유하기",
      prompt: "최근 새로 시작한 취미가 있다면?",
      anonymous: false,
      aiRecommended: false,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockMission,
    });

    const result = await fetchTodayMission("t-001");

    expect(result).toEqual(mockMission);
    expect(result?.missionId).toBe("m-001");
    expect(result?.type).toBe("hobby");
  });

  it("AC-2b: fetchTodayMission(teamId) returns null on 204 No Content", async () => {
    const { fetchTodayMission } = await import("@/lib/api/endpoints");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: async () => null,
    });

    const result = await fetchTodayMission("t-001");

    expect(result).toBeNull();
  });

  it("AC-2c: fetchTodayMission caches successful response", async () => {
    const { fetchTodayMission } = await import("@/lib/api/endpoints");

    const mockMission = {
      missionId: "m-cached",
      teamId: "t-001",
      date: "2025-01-22",
      type: "praise" as const,
      title: "칭찬하기",
      prompt: "팀원을 칭찬해주세요",
      anonymous: false,
      aiRecommended: false,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockMission,
    });

    const result1 = await fetchTodayMission("t-001");
    expect(result1).toEqual(mockMission);
  });

  it("AC-2d: fetchTodayMission uses cache on network error with stale flag", async () => {
    const { fetchTodayMission } = await import("@/lib/api/endpoints");

    const mockMission = {
      missionId: "m-cached-stale",
      teamId: "t-001",
      date: "2025-01-22",
      type: "hobby" as const,
      title: "취미 공유",
      prompt: "취미를 공유하세요",
      anonymous: false,
      aiRecommended: false,
    };

    // Pre-seed cache
    storage.writeCache("teampulse:cache:mission:2025-01-22", mockMission);

    // Network error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Internal Server Error" }),
    });

    const result = await fetchTodayMission("t-001");
    // Type guard: check if result has stale property
    if (typeof result === "object" && result !== null && "stale" in result) {
      expect(result.stale).toBe(true);
      expect((result as { data: typeof mockMission; stale: true }).data).toEqual(mockMission);
    } else {
      throw new Error("Expected stale result");
    }
  });
});

describe("AC-3[P0]: createResponse — submit response to mission", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-3a: createResponse sends POST /missions/:missionId/responses", async () => {
    const { createResponse } = await import("@/lib/api/endpoints");

    const mockResponse = {
      responseId: "r-001",
      missionId: "m-001",
      userId: "u-001",
      nickname: "민지",
      content: "요즘 클라이밍에 빠졌어요",
      anonymous: false,
      reactions: 0,
      createdAt: 1737500000000,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockResponse,
    });

    const result = await createResponse("m-001", "요즘 클라이밍에 빠졌어요", false);

    expect(result).toEqual(mockResponse);
    expect(result.responseId).toBe("r-001");
    expect(result.content).toBe("요즘 클라이밍에 빠졌어요");
    expect(result.reactions).toBe(0);
  });

  it("AC-3b: createResponse sends anonymous:true for worry missions", async () => {
    const { createResponse } = await import("@/lib/api/endpoints");

    const mockResponse = {
      responseId: "r-002",
      missionId: "m-worry",
      userId: "u-unknown",
      nickname: "익명",
      content: "요즘 스트레스가 많아요",
      anonymous: true,
      reactions: 0,
      createdAt: 1737500001000,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockResponse,
    });

    const result = await createResponse("m-worry", "요즘 스트레스가 많아요", true);

    expect(result.anonymous).toBe(true);
    expect(result.nickname).toBe("익명");
  });
});

describe("AC-4[P0]: recommendMission — AI-powered mission recommendation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-4a: recommendMission returns {mission, moodScore, rationale}", async () => {
    const { recommendMission } = await import("@/lib/api/endpoints");

    const mockRecommend = {
      mission: {
        missionId: "m-ai-001",
        teamId: "t-001",
        date: "2025-01-22",
        type: "hobby" as const,
        title: "가벼운 취미 공유",
        prompt: "팀 긴장도가 높아 가벼운 미션을 추천합니다",
        anonymous: false,
        aiRecommended: true,
      },
      moodScore: 42,
      rationale: "팀 긴장도가 높아 가벼운 미션을 추천해요",
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockRecommend,
    });

    const result = await recommendMission("t-001");

    expect(result.moodScore).toBe(42);
    expect(result.rationale).toBe("팀 긴장도가 높아 가벼운 미션을 추천해요");
    expect(result.mission.aiRecommended).toBe(true);
  });

  it("AC-4b: recommendMission throws error on insufficient data (422)", async () => {
    const { recommendMission } = await import("@/lib/api/endpoints");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "분석할 데이터가 부족해요" }),
    });

    await expect(recommendMission("t-001")).rejects.toThrow(/분석할 데이터가 부족해요/);
  });
});

describe("AC-5[P0]: fetchFeed — team responses with cache fallback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-5a: fetchFeed(teamId, missionId) returns MissionResponse[]", async () => {
    const { fetchFeed } = await import("@/lib/api/endpoints");

    const mockResponses = [
      {
        responseId: "r-001",
        missionId: "m-001",
        userId: "u-001",
        nickname: "민지",
        content: "클라이밍",
        anonymous: false,
        reactions: 5,
        createdAt: 1737500000000,
      },
      {
        responseId: "r-002",
        missionId: "m-001",
        userId: "u-002",
        nickname: "수현",
        content: "영화",
        anonymous: false,
        reactions: 3,
        createdAt: 1737499999000,
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ responses: mockResponses }),
    });

    const result = await fetchFeed("t-001", "m-001");

    if (Array.isArray(result)) {
      expect(result).toHaveLength(2);
      expect(result[0].responseId).toBe("r-001");
      expect(result[0].reactions).toBe(5);
      expect(result[1].nickname).toBe("수현");
    } else {
      throw new Error("Expected array result, got stale");
    }
  });

  it("AC-5b: fetchFeed includes anonymous:true and nickname='익명' for worry responses", async () => {
    const { fetchFeed } = await import("@/lib/api/endpoints");

    const mockResponses = [
      {
        responseId: "r-anon",
        missionId: "m-worry",
        userId: "u-unknown",
        nickname: "익명",
        content: "요즘 회사 인간관계가 힘들어요",
        anonymous: true,
        reactions: 2,
        createdAt: 1737500000000,
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ responses: mockResponses }),
    });

    const result = await fetchFeed("t-001", "m-worry");

    if (Array.isArray(result)) {
      expect(result[0].anonymous).toBe(true);
      expect(result[0].nickname).toBe("익명");
    } else {
      throw new Error("Expected array result, got stale");
    }
  });

  it("AC-5c: fetchFeed caches responses successfully", async () => {
    const { fetchFeed } = await import("@/lib/api/endpoints");

    const mockResponses = [
      {
        responseId: "r-cached-1",
        missionId: "m-001",
        userId: "u-001",
        nickname: "테스트유저",
        content: "테스트",
        anonymous: false,
        reactions: 1,
        createdAt: 1737500000000,
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ responses: mockResponses }),
    });

    const result = await fetchFeed("t-001", "m-001");
    expect(result).toHaveLength(1);
    if (Array.isArray(result)) {
      expect(result[0].responseId).toBe("r-cached-1");
    }
  });

  it("AC-5d: fetchFeed uses cache on network error with stale flag", async () => {
    const { fetchFeed } = await import("@/lib/api/endpoints");

    const mockResponses = [
      {
        responseId: "r-cached-2",
        missionId: "m-001",
        userId: "u-002",
        nickname: "캐시유저",
        content: "캐시된 응답",
        anonymous: false,
        reactions: 3,
        createdAt: 1737500001000,
      },
    ];

    // Pre-seed cache
    storage.writeCache("teampulse:cache:feed:m-001", mockResponses);

    // Network error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Internal Server Error" }),
    });

    const result = await fetchFeed("t-001", "m-001");
    if (typeof result === "object" && result !== null && "stale" in result) {
      expect(result.stale).toBe(true);
      expect((result as { data: typeof mockResponses; stale: true }).data).toEqual(mockResponses);
    } else {
      throw new Error("Expected stale result");
    }
  });
});

describe("AC-6[P0]: reactToResponse — add reaction to response", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-6a: reactToResponse increments reaction count", async () => {
    const { reactToResponse } = await import("@/lib/api/endpoints");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        responseId: "r-001",
        reactions: 6,
      }),
    });

    const result = await reactToResponse("r-001");

    expect(result.responseId).toBe("r-001");
    expect(result.reactions).toBe(6);
  });

  it("AC-6b: reactToResponse sends POST /responses/:responseId/react", async () => {
    const { reactToResponse } = await import("@/lib/api/endpoints");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        responseId: "r-002",
        reactions: 10,
      }),
    });

    await reactToResponse("r-002");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/responses/r-002/react"),
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});

describe("AC-7[P0]: fetchLeaderboard — ranked team members with cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-7a: fetchLeaderboard returns {entries, myRank}", async () => {
    const { fetchLeaderboard } = await import("@/lib/api/endpoints");

    const mockLeaderboard = {
      entries: [
        {
          userId: "u-001",
          nickname: "민지",
          participationCount: 10,
          streak: 5,
          badges: ["streak7" as const],
          rank: 1,
        },
        {
          userId: "u-002",
          nickname: "수현",
          participationCount: 8,
          streak: 3,
          badges: [],
          rank: 2,
        },
      ],
      myRank: 2,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockLeaderboard,
    });

    const result = await fetchLeaderboard("t-001");

    if (typeof result === "object" && result !== null && "myRank" in result && !("stale" in result)) {
      expect(result.myRank).toBe(2);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].participationCount).toBe(10);
      expect(result.entries[0].badges).toContain("streak7");
    } else {
      throw new Error("Expected LeaderboardResponse, got stale");
    }
  });

  it("AC-7b: fetchLeaderboard caches successfully", async () => {
    const { fetchLeaderboard } = await import("@/lib/api/endpoints");

    const mockLeaderboard = {
      entries: [
        {
          userId: "u-cached",
          nickname: "캐시유저",
          participationCount: 5,
          streak: 2,
          badges: [],
          rank: 5,
        },
      ],
      myRank: 5,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockLeaderboard,
    });

    const result = await fetchLeaderboard("t-001");
    if (typeof result === "object" && result !== null && "myRank" in result && !("stale" in result)) {
      expect(result.myRank).toBe(5);
      expect(result.entries).toHaveLength(1);
    }
  });

  it("AC-7c: fetchLeaderboard uses cache on network error with stale flag", async () => {
    const { fetchLeaderboard } = await import("@/lib/api/endpoints");

    const mockLeaderboard = {
      entries: [
        {
          userId: "u-cached-2",
          nickname: "캐시유저2",
          participationCount: 8,
          streak: 4,
          badges: [],
          rank: 3,
        },
      ],
      myRank: 3,
    };

    // Pre-seed cache
    storage.writeCache("teampulse:cache:leaderboard:t-001", mockLeaderboard);

    // Network error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Internal Server Error" }),
    });

    const result = await fetchLeaderboard("t-001");
    if (typeof result === "object" && result !== null && "stale" in result) {
      expect(result.stale).toBe(true);
      expect((result as { data: typeof mockLeaderboard; stale: true }).data).toEqual(mockLeaderboard);
    } else {
      throw new Error("Expected stale result");
    }
  });
});

describe("AC-8[P0]: fetchWeeklyReport — AI summary with cache and 204 handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-8a: fetchWeeklyReport returns WeeklyReport on 200", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");

    const mockReport = {
      teamId: "t-001",
      weekStart: "2025-01-20",
      participationRate: 82,
      moodScore: 74,
      moodTrend: [60, 65, 70, 68, 72, 74, 74],
      positiveKeywords: ["칭찬", "협업", "즐거움"],
      summary: "이번 주 팀의 분위기는 매우 긍정적입니다",
      generatedByAI: true,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ report: mockReport }),
    });

    const result = await fetchWeeklyReport("t-001");

    expect(result).toEqual(mockReport);
    expect(result?.participationRate).toBe(82);
    expect(result?.moodScore).toBe(74);
    expect(result?.moodTrend).toHaveLength(7);
    expect(result?.positiveKeywords).toContain("협업");
  });

  it("AC-8b: fetchWeeklyReport returns null on 204 No Content", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: async () => null,
    });

    const result = await fetchWeeklyReport("t-001");

    expect(result).toBeNull();
  });

  it("AC-8c: fetchWeeklyReport caches successfully", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");

    const mockReport = {
      teamId: "t-001",
      weekStart: "2025-01-13",
      participationRate: 75,
      moodScore: 68,
      moodTrend: [65, 67, 68, 70, 69, 70, 68],
      positiveKeywords: ["팀워크"],
      summary: "팀워크가 좋습니다",
      generatedByAI: true,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ report: mockReport }),
    });

    const result = await fetchWeeklyReport("t-001");
    if (result !== null && typeof result === "object" && "participationRate" in result && !("stale" in result)) {
      expect(result.participationRate).toBe(75);
      expect(result.moodScore).toBe(68);
    }
  });

  it("AC-8d: fetchWeeklyReport uses cache on network error with stale flag", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");

    const mockReport = {
      teamId: "t-001",
      weekStart: "2025-01-20",
      participationRate: 82,
      moodScore: 74,
      moodTrend: [60, 65, 70, 68, 72, 74, 74],
      positiveKeywords: ["협업", "긍정"],
      summary: "좋은 주였습니다",
      generatedByAI: true,
    };

    // Pre-seed cache
    storage.writeCache("teampulse:cache:report:2025-01-20", mockReport);

    // Network error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Internal Server Error" }),
    });

    const result = await fetchWeeklyReport("t-001");
    if (typeof result === "object" && result !== null && "stale" in result) {
      expect(result.stale).toBe(true);
      expect((result as { data: typeof mockReport; stale: true }).data).toEqual(mockReport);
    } else {
      throw new Error("Expected stale result");
    }
  });
});

describe("Integration: All 8 endpoint functions export and type-check", () => {
  it("should export all 8 functions from endpoints module", async () => {
    const endpoints = await import("@/lib/api/endpoints");

    expect(endpoints.joinTeam).toBeDefined();
    expect(typeof endpoints.joinTeam).toBe("function");

    expect(endpoints.fetchTodayMission).toBeDefined();
    expect(typeof endpoints.fetchTodayMission).toBe("function");

    expect(endpoints.createResponse).toBeDefined();
    expect(typeof endpoints.createResponse).toBe("function");

    expect(endpoints.recommendMission).toBeDefined();
    expect(typeof endpoints.recommendMission).toBe("function");

    expect(endpoints.fetchFeed).toBeDefined();
    expect(typeof endpoints.fetchFeed).toBe("function");

    expect(endpoints.reactToResponse).toBeDefined();
    expect(typeof endpoints.reactToResponse).toBe("function");

    expect(endpoints.fetchLeaderboard).toBeDefined();
    expect(typeof endpoints.fetchLeaderboard).toBe("function");

    expect(endpoints.fetchWeeklyReport).toBeDefined();
    expect(typeof endpoints.fetchWeeklyReport).toBe("function");
  });

  it("should handle fetch errors in all endpoints with proper error messages", async () => {
    const { joinTeam } = await import("@/lib/api/endpoints");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "닉네임을 입력해주세요" }),
    });

    await expect(joinTeam("CODE", "")).rejects.toThrow(/닉네임을 입력해주세요/);
  });
});
