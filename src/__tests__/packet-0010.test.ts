import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { screen, within, waitFor, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * PACKET 0010: 팀 피드 페이지 /feed
 *
 * TDD Phase: Tests are written FIRST. src/pages/Feed.tsx does not exist yet —
 * these tests WILL FAIL until the Coder implements it.
 *
 * Expected behavior of src/pages/Feed.tsx (per packet 0010):
 * - On mount, calls fetchFeed(profile.teamId, initialMissionId) where
 *   initialMissionId comes from (location.state as RouteState["/feed"])?.missionId.
 * - Loading: LoadingState (TDS Skeleton × 3) while fetchFeed is pending.
 * - Empty (fetchFeed resolves to []): EmptyState is shown.
 * - Each response row shows the row's nickname, or "익명" when response.anonymous is true.
 * - Rows are sorted newest first (createdAt desc), regardless of the order fetchFeed returns.
 * - Each row exposes a reaction control:
 *     - wrapper: data-testid={`reaction-${responseId}`}, inline style with
 *       minWidth >= 44 and minHeight >= 44 (touch target).
 *     - inside: a `role="button"` element whose text includes "공감 {count}".
 *   Tapping it: calls generateHapticFeedback({ type: "tickWeak" }), optimistically
 *   increments the shown count by 1 immediately (before the network call settles),
 *   then calls reactToResponse(responseId).
 *     - success: count stays at the server value (no visible flicker back down).
 *     - failure: count rolls back to the pre-tap value AND a Toast with the text
 *       "잠시 후 다시 시도해주세요" is shown.
 * - Zero console.error calls during any of the above.
 *
 * AC-1 [P0]: 공감 탭 시 낙관적 +1, 실패 시 롤백 + Toast 표시
 * AC-2 [P1]: 익명 응답 작성자 "익명" 표기 + 응답 0건 시 EmptyState
 * AC-3 [P0/P1]: location.state.missionId 캐스팅 초기 필터, 공감 버튼 ≥44px, console.error 0개
 */

mockAll();

const TEAM_ID = "t1";

const RESPONSES = [
  {
    responseId: "r2",
    missionId: "m1",
    userId: "u2",
    nickname: "지훈",
    content: "코딩 스터디 시작했어요",
    anonymous: true,
    reactions: 1,
    createdAt: 1000,
  },
  {
    responseId: "r1",
    missionId: "m1",
    userId: "u1",
    nickname: "민지",
    content: "이번 주 등산 다녀왔어요",
    anonymous: false,
    reactions: 3,
    createdAt: 2000,
  },
];

vi.mock("@/lib/api/endpoints", () => ({
  fetchFeed: vi.fn(),
  reactToResponse: vi.fn(),
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

async function renderFeed(initialEntries?: unknown[]) {
  const { default: Feed } = await import("@/pages/Feed");
  renderWithRouter(
    React.createElement(Feed),
    initialEntries ? { initialEntries: initialEntries as never } : undefined,
  );
}

function reactionButton(responseId: string) {
  const wrapper = screen.getByTestId(`reaction-${responseId}`);
  return { wrapper, button: within(wrapper).getByRole("button") };
}

describe("팀 피드 페이지 /feed", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC-1[P0]: 공감 탭 시 낙관적 +1, 실패 시 롤백+Toast", () => {
    it("AC-1a[P0]: 공감 탭 시 즉시 +1 낙관적 반영되고 tickWeak 햅틱이 호출된다", async () => {
      const { fetchFeed, reactToResponse } = await import("@/lib/api/endpoints");
      const { generateHapticFeedback } = await import("@apps-in-toss/web-framework");
      (fetchFeed as ReturnType<typeof vi.fn>).mockResolvedValueOnce([...RESPONSES]);
      let resolveReact!: (v: { responseId: string; reactions: number }) => void;
      (reactToResponse as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise((resolve) => { resolveReact = resolve; }),
      );

      await renderFeed();
      await waitFor(() => {
        expect(screen.getByTestId("reaction-r1")).toBeTruthy();
      });

      const { button } = reactionButton("r1");
      expect(button.textContent).toContain("공감 3");

      fireEvent.click(button);

      // optimistic bump happens synchronously, before the mocked network call resolves
      expect(reactionButton("r1").button.textContent).toContain("공감 4");
      expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });

      resolveReact({ responseId: "r1", reactions: 4 });
      await waitFor(() => {
        expect(reactionButton("r1").button.textContent).toContain("공감 4");
      });
    });

    it("AC-1b[P0]: 공감 실패 시 카운트를 원래 값으로 롤백하고 재시도 안내 Toast를 표시한다", async () => {
      const { fetchFeed, reactToResponse } = await import("@/lib/api/endpoints");
      (fetchFeed as ReturnType<typeof vi.fn>).mockResolvedValueOnce([...RESPONSES]);
      (reactToResponse as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network"));

      await renderFeed();
      await waitFor(() => {
        expect(screen.getByTestId("reaction-r1")).toBeTruthy();
      });

      const { button } = reactionButton("r1");
      expect(button.textContent).toContain("공감 3");

      fireEvent.click(button);
      expect(reactionButton("r1").button.textContent).toContain("공감 4");

      await waitFor(() => {
        expect(reactionButton("r1").button.textContent).toContain("공감 3");
      });
      expect(screen.getByText("잠시 후 다시 시도해주세요").textContent).toBe(
        "잠시 후 다시 시도해주세요",
      );
    });
  });

  describe("AC-2[P1]: 익명 표기 + 빈 상태", () => {
    it("AC-2a[P1]: 익명 응답은 작성자가 '익명'으로 표시되고, 익명 아닌 응답은 실제 닉네임을 표시한다", async () => {
      const { fetchFeed } = await import("@/lib/api/endpoints");
      (fetchFeed as ReturnType<typeof vi.fn>).mockResolvedValueOnce([...RESPONSES]);

      await renderFeed();

      await waitFor(() => {
        expect(screen.getByTestId("feed-item-r2")).toBeTruthy();
      });

      const anonymousRow = screen.getByTestId("feed-item-r2");
      expect(anonymousRow.textContent).toContain("익명");
      expect(anonymousRow.textContent).not.toContain("지훈");

      const namedRow = screen.getByTestId("feed-item-r1");
      expect(namedRow.textContent).toContain("민지");
    });

    it("AC-2b[P1]: 응답이 0건이면 EmptyState를 표시한다", async () => {
      const { fetchFeed } = await import("@/lib/api/endpoints");
      (fetchFeed as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      await renderFeed();

      await waitFor(() => {
        expect(screen.queryAllByTestId(/^feed-item-/)).toHaveLength(0);
      });
      expect(screen.getByText(/응답이 아직 없어요|아직 응답이 없어요/).textContent).toMatch(
        /응답/,
      );
    });

    it("로딩 중에는 Skeleton ListRow 3개를 표시하고 응답 목록은 렌더하지 않는다", async () => {
      const { fetchFeed } = await import("@/lib/api/endpoints");
      let resolveFeed!: (v: typeof RESPONSES) => void;
      (fetchFeed as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFeed = resolve; }),
      );

      await renderFeed();

      expect(document.querySelectorAll('[data-skeleton="true"]')).toHaveLength(3);
      expect(screen.queryAllByTestId(/^feed-item-/)).toHaveLength(0);

      resolveFeed([...RESPONSES]);
      await waitFor(() => {
        expect(screen.getByTestId("feed-item-r1")).toBeTruthy();
      });
    });
  });

  describe("AC-3: location.state 초기 필터 + 공감 버튼 44px + console.error 0개", () => {
    it("AC-3a[P1]: location.state.missionId를 캐스팅해 초기 필터로 fetchFeed에 전달한다", async () => {
      const { fetchFeed } = await import("@/lib/api/endpoints");
      (fetchFeed as ReturnType<typeof vi.fn>).mockResolvedValueOnce([...RESPONSES]);

      await renderFeed([{ pathname: "/feed", state: { missionId: "m1" } }]);

      await waitFor(() => {
        expect(fetchFeed).toHaveBeenCalledWith(TEAM_ID, "m1");
      });
    });

    it("AC-3b[P0]: 공감 버튼은 최소 44x44px 터치 영역을 갖는다", async () => {
      const { fetchFeed } = await import("@/lib/api/endpoints");
      (fetchFeed as ReturnType<typeof vi.fn>).mockResolvedValueOnce([...RESPONSES]);

      await renderFeed();

      await waitFor(() => {
        expect(screen.getByTestId("reaction-r1")).toBeTruthy();
      });

      const { wrapper } = reactionButton("r1");
      const minWidth = parseInt(wrapper.style.minWidth || "0", 10);
      const minHeight = parseInt(wrapper.style.minHeight || "0", 10);
      expect(minWidth).toBeGreaterThanOrEqual(44);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it("AC-3c[P0]: location.state가 없어도 크래시 없이 렌더하고 console.error가 호출되지 않는다", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { fetchFeed } = await import("@/lib/api/endpoints");
      (fetchFeed as ReturnType<typeof vi.fn>).mockResolvedValueOnce([...RESPONSES]);

      await renderFeed(["/feed"]);

      await waitFor(() => {
        expect(screen.getByTestId("feed-item-r1")).toBeTruthy();
      });

      expect(fetchFeed).toHaveBeenCalledWith(TEAM_ID, undefined);
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
