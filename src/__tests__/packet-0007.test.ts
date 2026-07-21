import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * PACKET 0007: 홈/오늘의 미션 표시 + 상태 컨테이너 /
 *
 * TDD Phase: Tests are written FIRST. The implementation (src/pages/Home.tsx)
 * does not yet contain this behavior. These tests WILL FAIL until it is implemented.
 *
 * Expected behavior of src/pages/Home.tsx (per packet 0007):
 * - On mount, calls fetchTodayMission(profile.teamId) (profile from useProfile()).
 * - Loading: shows a Skeleton-based loading card (aria-busy="true") — no mission-card yet.
 * - 204 / null response: shows EmptyState "오늘의 미션이 곧 열려요" and hides the response
 *   input form slot (no textbox rendered).
 * - Mission loaded, not yet responded: renders SummaryHero card with
 *   data-testid="mission-card" containing mission.title and mission.prompt.
 * - Mission loaded, already responded today (localStorage flag
 *   `teampulse:responded:{missionId}` === "true"): shows "이미 참여했어요" text and a
 *   "피드 보기" button that calls navigate('/feed', { state: { missionId } }).
 * - location.state is cast to RouteState["/"] ({ fromOnboarding?: boolean } | undefined)
 *   and the page must render without crashing whether state is present or absent.
 * - Zero console.error calls during any of the above.
 *
 * AC-1 [P0]: 미션 표시 및 Loading/204/참여완료 상태 전환 동작
 * AC-2 [P1]: location.state를 RouteState로 캐스팅 (state 있음/없음 모두 안전)
 * AC-3 [P0]: mission-card testid 충족, console.error 0개
 */

mockAll();

const TEAM_ID = "t1";
const MISSION = {
  missionId: "m1",
  teamId: TEAM_ID,
  date: "2026-07-22",
  type: "hobby" as const,
  title: "이번 주 취미 자랑하기",
  prompt: "요즘 빠진 취미가 있다면 알려주세요",
  anonymous: false,
  aiRecommended: false,
};

vi.mock("@/lib/api/endpoints", () => ({
  fetchTodayMission: vi.fn(),
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

async function renderHome(initialEntries?: unknown[]) {
  const { default: Home } = await import("@/pages/Home");
  renderWithRouter(
    React.createElement(Home),
    initialEntries ? { initialEntries: initialEntries as never } : undefined,
  );
}

describe("홈/오늘의 미션 표시 + 상태 컨테이너 /", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC-1[P0]: 미션 표시 및 Loading/204/참여완료 상태 전환", () => {
    it("AC-1a[P0]: 로딩 중에는 Skeleton 로딩 카드를 표시하고 mission-card는 아직 렌더하지 않는다", async () => {
      const { fetchTodayMission } = await import("@/lib/api/endpoints");
      let resolveMission!: (value: typeof MISSION) => void;
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveMission = resolve;
          }),
      );

      await renderHome();

      expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(screen.queryByTestId("mission-card")).toBeNull();

      resolveMission(MISSION);
      await waitFor(() => {
        expect(screen.queryByTestId("mission-card")).not.toBeNull();
      });
    });

    it("AC-1b[P0]: 오늘 미션이 없으면(204/null) 빈 상태 문구를 표시하고 입력 폼을 숨긴다", async () => {
      const { fetchTodayMission } = await import("@/lib/api/endpoints");
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await renderHome();

      await waitFor(() => {
        expect(screen.getByText("오늘의 미션이 곧 열려요").textContent).toBe(
          "오늘의 미션이 곧 열려요",
        );
      });

      expect(screen.queryByTestId("mission-card")).toBeNull();
      expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    });

    it("AC-1c[P0]: 미션이 있고 아직 참여 전이면 mission-card에 제목과 prompt를 표시한다", async () => {
      const { fetchTodayMission } = await import("@/lib/api/endpoints");
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(MISSION);

      await renderHome();

      await waitFor(() => {
        expect(screen.queryByTestId("mission-card")).not.toBeNull();
      });

      const card = screen.getByTestId("mission-card");
      expect(card.textContent).toContain("이번 주 취미 자랑하기");
      expect(card.textContent).toContain("요즘 빠진 취미가 있다면 알려주세요");
      expect(screen.queryByText("이미 참여했어요")).toBeNull();
    });

    it("AC-1d[P0]: 오늘 이미 참여했다면 '이미 참여했어요'와 피드 보기 버튼을 표시하고, 클릭 시 /feed로 이동한다", async () => {
      localStorage.setItem(`teampulse:responded:${MISSION.missionId}`, "true");
      const { fetchTodayMission } = await import("@/lib/api/endpoints");
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(MISSION);

      await renderHome();

      await waitFor(() => {
        expect(screen.getByText("이미 참여했어요").textContent).toBe("이미 참여했어요");
      });

      const feedButton = screen.getByRole("button", { name: /피드 보기/ });
      fireEvent.click(feedButton);

      expect(mockNavigate).toHaveBeenCalledWith("/feed", {
        state: { missionId: MISSION.missionId },
      });
    });
  });

  describe("AC-2[P1]: location.state를 RouteState로 캐스팅", () => {
    it("AC-2a[P1]: location.state가 없어도(직접 진입) 크래시 없이 렌더한다", async () => {
      const { fetchTodayMission } = await import("@/lib/api/endpoints");
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(MISSION);

      await renderHome(["/"]);

      await waitFor(() => {
        expect(screen.queryByTestId("mission-card")).not.toBeNull();
      });
      expect(screen.getByText("오늘의 미션").textContent).toBe("오늘의 미션");
    });

    it("AC-2b[P1]: location.state={fromOnboarding:true}로 진입해도 크래시 없이 렌더한다", async () => {
      const { fetchTodayMission } = await import("@/lib/api/endpoints");
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(MISSION);

      await renderHome([{ pathname: "/", state: { fromOnboarding: true } }]);

      await waitFor(() => {
        expect(screen.queryByTestId("mission-card")).not.toBeNull();
      });
      expect(screen.getByText("오늘의 미션").textContent).toBe("오늘의 미션");
    });
  });

  describe("AC-3[P0]: mission-card testid + console.error 0개", () => {
    it("AC-3a[P0]: 정상 로드 시 mission-card testid가 존재하고 console.error가 호출되지 않는다", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { fetchTodayMission } = await import("@/lib/api/endpoints");
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(MISSION);

      await renderHome();

      await waitFor(() => {
        expect(screen.queryByTestId("mission-card")).not.toBeNull();
      });

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
