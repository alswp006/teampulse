import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * PACKET 0011: 리더보드 페이지 /leaderboard
 *
 * TDD Phase: Tests are written FIRST. src/pages/Leaderboard.tsx does not exist yet —
 * these tests WILL FAIL until the Coder implements it.
 *
 * Expected behavior of src/pages/Leaderboard.tsx (per packet 0011):
 * - On mount, calls fetchLeaderboard(profile.teamId).
 * - Response shape: LeaderboardResponse { entries: LeaderboardEntry[]; myRank: number }
 *   (fetchLeaderboard may also resolve a { data: LeaderboardResponse; stale: true }
 *   cache-fallback wrapper — page must unwrap it the same way Feed unwraps fetchFeed).
 * - SummaryHero with data-testid="my-rank-hero" shows the current user's rank (myRank)
 *   and the current user's streak (looked up from entries by profile.userId).
 * - Each team ranking row is wrapped in a container with
 *   data-testid={`rank-row-${entry.userId}`} and shows: rank, participationCount, streak.
 * - Each badge on a row is rendered as a Chip inside a wrapper with
 *   data-testid={`badge-${entry.userId}-${badgeId}`}, inline style with
 *   minWidth >= 44 and minHeight >= 44 (touch target).
 * - Loading: LoadingState (TDS Skeleton x3) while fetchLeaderboard is pending, no rows shown.
 * - Empty (entries: []): EmptyState is shown, no rank-row-* rendered.
 * - Zero console.error calls during any of the above.
 *
 * AC-1 [P0]: my-rank-hero testid 렌더 + 팀 랭킹 ListRow(rank-row-*) N개 렌더
 * AC-2 [P0]: 각 행에 순위·참여·streak·배지 표시, 배지 Chip ≥44px 터치 타깃
 * AC-3 [P1]: Loading/Empty 상태 처리, console.error 0개
 */

mockAll();

const TEAM_ID = "t1";

const ENTRIES = [
  {
    userId: "u2",
    nickname: "지훈",
    participationCount: 20,
    streak: 10,
    badges: ["first_responder", "top_praise"],
    rank: 1,
  },
  {
    userId: "u1",
    nickname: "민지",
    participationCount: 12,
    streak: 5,
    badges: ["streak7"],
    rank: 2,
  },
  {
    userId: "u3",
    nickname: "서연",
    participationCount: 8,
    streak: 2,
    badges: [],
    rank: 3,
  },
];

const LEADERBOARD_RESPONSE = { entries: ENTRIES, myRank: 2 };

vi.mock("@/lib/api/endpoints", () => ({
  fetchLeaderboard: vi.fn(),
}));

vi.mock("@/lib/profileContext", () => ({
  useProfile: () => ({
    profile: {
      userId: "u1",
      teamId: TEAM_ID,
      teamName: "디자인팀",
      nickname: "민지",
      joinedAt: 0,
    },
    setProfileAndPersist: vi.fn(),
    aiNoticeAck: true,
    ackAiNotice: vi.fn(),
  }),
}));

async function renderLeaderboard() {
  const { default: Leaderboard } = await import("@/pages/Leaderboard");
  renderWithRouter(React.createElement(Leaderboard));
}

describe("리더보드 페이지 /leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC-1[P0]: my-rank-hero + 팀 랭킹 행 렌더", () => {
    it("AC-1a[P0]: 내 순위/연속 참여 SummaryHero와 팀 랭킹 행 3개를 렌더한다", async () => {
      const { fetchLeaderboard } = await import("@/lib/api/endpoints");
      (fetchLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...LEADERBOARD_RESPONSE,
      });

      await renderLeaderboard();

      await waitFor(() => {
        expect(screen.getByTestId("my-rank-hero")).toBeTruthy();
      });

      const hero = screen.getByTestId("my-rank-hero");
      expect(hero.textContent).toContain("2");
      expect(hero.textContent).toContain("5");

      expect(screen.getAllByTestId(/^rank-row-/)).toHaveLength(3);
      expect(fetchLeaderboard).toHaveBeenCalledWith(TEAM_ID);
    });

    it("AC-1b[P0]: 각 랭킹 행은 해당 유저의 userId를 가진 rank-row testid를 갖는다", async () => {
      const { fetchLeaderboard } = await import("@/lib/api/endpoints");
      (fetchLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...LEADERBOARD_RESPONSE,
      });

      await renderLeaderboard();

      await waitFor(() => {
        expect(screen.getByTestId("rank-row-u2")).toBeTruthy();
      });
      expect(screen.getByTestId("rank-row-u1")).toBeTruthy();
      expect(screen.getByTestId("rank-row-u3")).toBeTruthy();
    });
  });

  describe("AC-2[P0]: 행 정보 표시 + 배지 터치 타깃", () => {
    it("AC-2a[P0]: 각 행은 순위·참여 횟수·streak를 표시한다", async () => {
      const { fetchLeaderboard } = await import("@/lib/api/endpoints");
      (fetchLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...LEADERBOARD_RESPONSE,
      });

      await renderLeaderboard();

      await waitFor(() => {
        expect(screen.getByTestId("rank-row-u2")).toBeTruthy();
      });

      const topRow = screen.getByTestId("rank-row-u2");
      expect(topRow.textContent).toContain("1");
      expect(topRow.textContent).toContain("20");
      expect(topRow.textContent).toContain("10");

      const thirdRow = screen.getByTestId("rank-row-u3");
      expect(thirdRow.textContent).toContain("8");
      expect(thirdRow.textContent).toContain("2");
    });

    it("AC-2b[P0]: 배지 Chip은 최소 44x44px 터치 영역을 갖는다", async () => {
      const { fetchLeaderboard } = await import("@/lib/api/endpoints");
      (fetchLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...LEADERBOARD_RESPONSE,
      });

      await renderLeaderboard();

      await waitFor(() => {
        expect(screen.getByTestId("badge-u1-streak7")).toBeTruthy();
      });

      const badge = screen.getByTestId("badge-u1-streak7");
      const minWidth = parseInt((badge as HTMLElement).style.minWidth || "0", 10);
      const minHeight = parseInt((badge as HTMLElement).style.minHeight || "0", 10);
      expect(minWidth).toBeGreaterThanOrEqual(44);
      expect(minHeight).toBeGreaterThanOrEqual(44);

      expect(screen.getByTestId("badge-u2-first_responder")).toBeTruthy();
      expect(screen.getByTestId("badge-u2-top_praise")).toBeTruthy();
    });
  });

  describe("AC-3[P1]: Loading/Empty + console.error 0개", () => {
    it("AC-3a[P1]: 로딩 중에는 Skeleton 3개를 표시하고 랭킹 행은 렌더하지 않는다", async () => {
      const { fetchLeaderboard } = await import("@/lib/api/endpoints");
      let resolveLeaderboard!: (v: typeof LEADERBOARD_RESPONSE) => void;
      (fetchLeaderboard as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise((resolve) => { resolveLeaderboard = resolve; }),
      );

      await renderLeaderboard();

      expect(document.querySelectorAll('[data-skeleton="true"]')).toHaveLength(3);
      expect(screen.queryAllByTestId(/^rank-row-/)).toHaveLength(0);

      resolveLeaderboard({ ...LEADERBOARD_RESPONSE });
      await waitFor(() => {
        expect(screen.getByTestId("rank-row-u1")).toBeTruthy();
      });
    });

    it("AC-3b[P1]: 팀 랭킹이 0건이면 EmptyState를 표시하고 랭킹 행은 렌더하지 않는다", async () => {
      const { fetchLeaderboard } = await import("@/lib/api/endpoints");
      (fetchLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        entries: [],
        myRank: 0,
      });

      await renderLeaderboard();

      await waitFor(() => {
        expect(screen.queryAllByTestId(/^rank-row-/)).toHaveLength(0);
      });
      expect(screen.getByText(/랭킹이 아직 없어요|아직 랭킹이 없어요|팀원.*참여/)).toBeTruthy();
    });

    it("AC-3c[P0]: 정상 렌더 동안 console.error가 호출되지 않는다", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { fetchLeaderboard } = await import("@/lib/api/endpoints");
      (fetchLeaderboard as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ...LEADERBOARD_RESPONSE,
      });

      await renderLeaderboard();

      await waitFor(() => {
        expect(screen.getByTestId("my-rank-hero")).toBeTruthy();
      });

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
