import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockTossRewardAd, mockRouter } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * PACKET 0009: AI 미션 추천 & 분위기 섹션 (홈 내 모듈)
 *
 * TDD Phase: Tests are written FIRST. src/pages/home/AiRecommendSection.tsx does
 * not exist yet — these tests WILL FAIL until the Coder implements it (and wires
 * it into src/pages/Home.tsx).
 *
 * Expected contract of src/pages/home/AiRecommendSection.tsx:
 * - Named export `AiRecommendSection()` — no required props. Reads `teamId` /
 *   `aiNoticeAck` / `ackAiNotice` from `useProfile()` (@/lib/profileContext).
 * - Renders a TDS `Button` (display="block") with the accessible name
 *   "AI 추천 미션 받기".
 * - On click, when `aiNoticeAck` is false:
 *   - Opens a TDS `AlertDialog` (role="alertdialog") titled
 *     "이 서비스는 생성형 AI를 활용합니다". Does NOT call `recommendMission` yet.
 *   - Confirming the dialog (button "확인") calls `ackAiNotice()` and THEN calls
 *     `recommendMission(teamId)`.
 * - On click, when `aiNoticeAck` is already true: calls `recommendMission(teamId)`
 *   directly — no AlertDialog is shown.
 * - While the `recommendMission` promise is pending: the trigger button's label
 *   becomes "팀 분위기를 분석하고 있어요" and the button is disabled.
 * - On success (`{ mission, rationale }`): renders `mission.title` and
 *   `rationale`, plus a badge element `data-testid="ai-badge"` with text
 *   "AI가 생성한 결과입니다".
 * - On failure where `error.message === "분석할 데이터가 부족해요"` (422 case):
 *   renders that exact message, renders NO `ai-badge`, and renders a fallback
 *   mission element `data-testid="fallback-mission"`.
 * - On any other failure (500 / timeout): shows a TDS `Toast` with text
 *   "지금은 추천을 못 받았어요. 기본 미션을 사용할게요", renders NO `ai-badge`,
 *   and renders a fallback mission element `data-testid="fallback-mission"`.
 * - Zero console.error calls during any of the above flows.
 *
 * src/pages/Home.tsx wires `<AiRecommendSection />` into the mission-loaded,
 * not-yet-responded branch (see the "AI 섹션 슬롯(packet 0009)" comment).
 *
 * AC-1 [P0]: 최초 탭 AI 고지 1회 → ack 저장·요청 진행, 이미 ack면 고지 스킵
 * AC-2 [P0]: 성공 시 ai-badge 상시 표시 / 500·타임아웃 폴백 토스트 / 422 데이터 부족 안내(배지 없음)
 * AC-3 [P1]: 대기 중 로딩 라벨, console.error 0개
 */

mockTds();
mockAppsInToss();
mockTossRewardAd();
mockRouter();

const RECOMMENDED_MISSION = {
  missionId: "m-ai-1",
  teamId: "t1",
  date: "2026-07-22",
  type: "hobby" as const,
  title: "가벼운 취미 이야기 나누기",
  prompt: "요즘 편하게 즐기는 취미를 알려주세요",
  anonymous: false,
  aiRecommended: true,
};

const RECOMMEND_SUCCESS = {
  mission: RECOMMENDED_MISSION,
  moodScore: 42,
  rationale: "팀 긴장도가 높아 가벼운 미션을 추천해요",
};

let mockAiNoticeAck = false;
const ackAiNotice = vi.fn(() => {
  mockAiNoticeAck = true;
});

vi.mock("@/lib/api/endpoints", () => ({
  fetchTodayMission: vi.fn(),
  createResponse: vi.fn(),
  recommendMission: vi.fn(),
}));

vi.mock("@/lib/profileContext", () => ({
  useProfile: () => ({
    profile: {
      userId: "u1",
      teamId: "t1",
      teamName: "디자인팀",
      nickname: "민지",
      joinedAt: 0,
    },
    setProfileAndPersist: vi.fn(),
    get aiNoticeAck() {
      return mockAiNoticeAck;
    },
    ackAiNotice,
  }),
}));

async function renderSection() {
  const { AiRecommendSection } = await import("@/pages/home/AiRecommendSection");
  renderWithRouter(React.createElement(AiRecommendSection));
}

function triggerButton() {
  return screen.getByRole("button", { name: /AI 추천 미션 받기|팀 분위기를 분석하고 있어요/ }) as HTMLButtonElement;
}

describe("AI 미션 추천 & 분위기 섹션 (홈 내 모듈)", () => {
  beforeEach(() => {
    mockAiNoticeAck = false;
    ackAiNotice.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC-1[P0]: AI 고지 1회 → ack 저장·요청 진행", () => {
    it("AC-1a[P0]: 최초 탭 시 AI 고지 AlertDialog가 표시되고 아직 recommendMission을 호출하지 않는다", async () => {
      const { recommendMission } = await import("@/lib/api/endpoints");
      (recommendMission as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

      await renderSection();
      fireEvent.click(triggerButton());

      const dialog = screen.getByRole("alertdialog");
      expect(dialog.textContent).toContain("이 서비스는 생성형 AI를 활용합니다");
      expect(recommendMission).not.toHaveBeenCalled();
    });

    it("AC-1b[P0]: 고지 확인 시 ackAiNotice가 호출되고 이어서 recommendMission이 teamId로 호출되며, 결과에 ai-badge가 표시된다", async () => {
      const { recommendMission } = await import("@/lib/api/endpoints");
      (recommendMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RECOMMEND_SUCCESS);

      await renderSection();
      fireEvent.click(triggerButton());
      fireEvent.click(screen.getByRole("button", { name: "확인" }));

      expect(ackAiNotice).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(recommendMission).toHaveBeenCalledWith("t1");
      });

      await waitFor(() => {
        expect(screen.getByText(RECOMMENDED_MISSION.title).textContent).toBe(
          RECOMMENDED_MISSION.title,
        );
      });
      expect(screen.getByText(RECOMMEND_SUCCESS.rationale).textContent).toBe(
        RECOMMEND_SUCCESS.rationale,
      );
      expect(screen.getByTestId("ai-badge").textContent).toBe("AI가 생성한 결과입니다");
    });

    it("AC-1c[P0]: 이미 ack된 상태면 고지 없이 바로 recommendMission을 호출한다", async () => {
      mockAiNoticeAck = true;
      const { recommendMission } = await import("@/lib/api/endpoints");
      (recommendMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RECOMMEND_SUCCESS);

      await renderSection();
      fireEvent.click(triggerButton());

      expect(screen.queryByRole("alertdialog")).toBeNull();
      await waitFor(() => {
        expect(recommendMission).toHaveBeenCalledWith("t1");
      });
      await waitFor(() => {
        expect(screen.getByTestId("ai-badge").textContent).toBe("AI가 생성한 결과입니다");
      });
    });
  });

  describe("AC-2[P0]: 폴백 처리 — 500/타임아웃 토스트, 422 데이터 부족 안내(배지 없음)", () => {
    it("AC-2a[P0]: 500/타임아웃 실패 시 폴백 토스트를 표시하고 기본 미션으로 대체하며 ai-badge는 없다", async () => {
      mockAiNoticeAck = true;
      const { recommendMission } = await import("@/lib/api/endpoints");
      (recommendMission as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("네트워크 연결을 확인해주세요"),
      );

      await renderSection();
      fireEvent.click(triggerButton());

      await waitFor(() => {
        expect(
          screen.getByText("지금은 추천을 못 받았어요. 기본 미션을 사용할게요").textContent,
        ).toBe("지금은 추천을 못 받았어요. 기본 미션을 사용할게요");
      });
      expect(screen.queryByTestId("ai-badge")).toBeNull();
      expect(screen.getByTestId("fallback-mission")).toBeTruthy();
    });

    it("AC-2b[P0]: 422(데이터 부족) 실패 시 안내 문구를 표시하고 배지 없이 기본 미션만 노출한다", async () => {
      mockAiNoticeAck = true;
      const { recommendMission } = await import("@/lib/api/endpoints");
      (recommendMission as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("분석할 데이터가 부족해요"),
      );

      await renderSection();
      fireEvent.click(triggerButton());

      await waitFor(() => {
        expect(screen.getByText("분석할 데이터가 부족해요").textContent).toBe(
          "분석할 데이터가 부족해요",
        );
      });
      expect(screen.queryByTestId("ai-badge")).toBeNull();
      expect(screen.getByTestId("fallback-mission")).toBeTruthy();
    });
  });

  describe("AC-3[P1]: 대기 중 로딩 라벨, console.error 0개", () => {
    it("AC-3a[P1]: 추천 API 응답 대기 중 버튼이 로딩 라벨로 바뀌고 비활성화된다", async () => {
      mockAiNoticeAck = true;
      const { recommendMission } = await import("@/lib/api/endpoints");
      (recommendMission as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

      await renderSection();
      fireEvent.click(triggerButton());

      await waitFor(() => {
        const button = screen.getByRole("button", { name: "팀 분위기를 분석하고 있어요" });
        expect(button.textContent).toBe("팀 분위기를 분석하고 있어요");
        expect((button as HTMLButtonElement).disabled).toBe(true);
      });
    });

    it("AC-3b[P0]: 전체 성공 플로우에서 console.error가 호출되지 않는다", async () => {
      mockAiNoticeAck = true;
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { recommendMission } = await import("@/lib/api/endpoints");
      (recommendMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RECOMMEND_SUCCESS);

      await renderSection();
      fireEvent.click(triggerButton());

      await waitFor(() => {
        expect(screen.getByTestId("ai-badge").textContent).toBe("AI가 생성한 결과입니다");
      });

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("Home 통합: AI 추천 섹션 슬롯 연결", () => {
    it("미션이 로드되고 아직 참여 전이면 홈 화면에 AI 추천 섹션이 렌더된다", async () => {
      mockAiNoticeAck = true;
      localStorage.removeItem(`teampulse:responded:${RECOMMENDED_MISSION.missionId}`);
      const { fetchTodayMission, recommendMission } = await import("@/lib/api/endpoints");
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        missionId: RECOMMENDED_MISSION.missionId,
        teamId: "t1",
        date: "2026-07-22",
        type: "hobby" as const,
        title: "이번 주 취미 자랑하기",
        prompt: "요즘 빠진 취미가 있다면 알려주세요",
        anonymous: false,
        aiRecommended: false,
      });
      (recommendMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RECOMMEND_SUCCESS);

      const { default: Home } = await import("@/pages/Home");
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("mission-card")).toBeTruthy();
      });
      expect(
        screen.getByRole("button", { name: "AI 추천 미션 받기" }),
      ).toBeTruthy();
    });
  });
});
