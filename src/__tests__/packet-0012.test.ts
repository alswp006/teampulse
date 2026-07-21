import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { screen, waitFor, cleanup } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * PACKET 0012: 주간 리포트 페이지 /report (보상형 광고 게이트)
 *
 * TDD Phase: Tests are written FIRST. src/pages/Report.tsx does not exist yet —
 * these tests WILL FAIL until the Coder implements it.
 *
 * Expected behavior of src/pages/Report.tsx (per packet 0012 + spec F7/S5):
 * - On mount, calls fetchWeeklyReport(profile.teamId).
 * - While pending: LoadingState (Skeleton). No gate button / report-card rendered yet.
 * - If resolved report is null (204, not yet generated): EmptyState
 *   "이번 주 리포트가 아직 준비되지 않았어요", no gate button / report-card.
 * - If a report is loaded: a gate button data-testid="report-view-button"
 *   ("이번 주 리포트 보기") is shown, inline style minHeight/minWidth >= 44 (touch target).
 *   The report-card is NOT rendered until the reward ad is watched to completion.
 * - Clicking the button triggers showFullScreenAd({ onEvent, onError, ... }).
 *   - event.type === "rewarded" (or "completed") → unlocks and renders the report:
 *     a single Card data-testid="report-card" containing participationRate,
 *     moodScore, a Sparkline data-testid="mood-sparkline" of moodTrend, positive
 *     keywords as Chips, and a badge data-testid="ai-badge" with the text
 *     "AI가 생성한 결과입니다" (always shown alongside the AI summary).
 *   - event.type === "dismissed" (ad closed early) → report-card stays hidden,
 *     a toast/message "광고를 끝까지 보면 리포트를 볼 수 있어요" is shown instead.
 * - AI 최초 이용 고지: on mount, if profile.aiNoticeAck is false, an AlertDialog
 *   (role="alertdialog") announcing generative-AI usage is shown; closing it calls
 *   ackAiNotice(). If aiNoticeAck is already true, the dialog is never shown
 *   (lifecycle-once, not shown on every visit).
 * - Zero console.error calls during normal rendering.
 *
 * AC-1 [P0]: 리포트 보기 버튼 → 보상형 광고 게이트 → 시청 완료 후 리포트 공개
 * AC-2 [P0]: report-card는 참여율/분위기 점수(SummaryHero)와 moodTrend(Sparkline)를 표시
 * AC-3 [P0]: report-card 하단에 ai-badge("AI가 생성한 결과입니다")를 항상 표시
 * AC-4 [P1]: 로딩 중 Skeleton
 * AC-5 [P1]: 리포트 미생성(null) → 빈 상태
 * AC-6 [P1]: 광고 시청 중단 → 리포트 대신 토스트
 * AC-7 [P0]: AI 고지는 앱 생애주기 1회만 노출
 */

mockAll();

const TEAM_ID = "t1";

const REPORT = {
  teamId: TEAM_ID,
  weekStart: "2026-07-13",
  participationRate: 82,
  moodScore: 74,
  moodTrend: [60, 65, 70, 68, 72, 74, 74],
  positiveKeywords: ["칭찬", "협업"],
  summary: "이번 주 팀은 서로 칭찬을 자주 나누며 협업 분위기가 좋았어요.",
  generatedByAI: true as const,
};

vi.mock("@/lib/api/endpoints", () => ({
  fetchWeeklyReport: vi.fn(),
}));

const profileMock = {
  profile: { userId: "u1", teamId: TEAM_ID, teamName: "디자인팀", nickname: "민지", joinedAt: 0 },
  setProfileAndPersist: vi.fn(),
  aiNoticeAck: true,
  ackAiNotice: vi.fn(),
};

vi.mock("@/lib/profileContext", () => ({
  useProfile: () => profileMock,
}));

async function renderReport() {
  // @ts-expect-error TDD red phase — src/pages/Report.tsx not yet implemented by the Coder
  const { default: Report } = await import("@/pages/Report");
  renderWithRouter(React.createElement(Report));
}

describe("주간 리포트 페이지 /report (보상형 광고 게이트)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMock.aiNoticeAck = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("AC-1a[P0]: 광고 시청 전에는 리포트 보기 버튼(≥44px)만 보이고 report-card는 렌더되지 않는다", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...REPORT });

    await renderReport();

    await waitFor(() => {
      expect(screen.getByTestId("report-view-button")).toBeTruthy();
    });

    const button = screen.getByTestId("report-view-button") as HTMLElement;
    const minHeight = parseInt(button.style.minHeight || "0", 10);
    expect(minHeight).toBeGreaterThanOrEqual(44);
    expect(button.textContent).toContain("리포트 보기");

    expect(screen.queryByTestId("report-card")).toBeNull();
    expect(fetchWeeklyReport).toHaveBeenCalledWith(TEAM_ID);
  });

  it("AC-1b[P0]: 버튼 클릭 → 보상형 광고 시청 완료 → report-card가 공개되고 console.error가 없다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...REPORT });

    await renderReport();

    await waitFor(() => {
      expect(screen.getByTestId("report-view-button")).toBeTruthy();
    });
    screen.getByTestId("report-view-button").click();

    await waitFor(() => {
      expect(screen.getByTestId("report-card")).toBeTruthy();
    });

    expect(screen.queryByTestId("report-view-button")).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("AC-2[P0]: report-card는 참여율·분위기 점수와 moodTrend 스파크라인, 긍정 키워드를 표시한다", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...REPORT });

    await renderReport();

    await waitFor(() => {
      expect(screen.getByTestId("report-view-button")).toBeTruthy();
    });
    screen.getByTestId("report-view-button").click();

    await waitFor(() => {
      expect(screen.getByTestId("report-card")).toBeTruthy();
    });

    const card = screen.getByTestId("report-card");
    await waitFor(() => {
      expect(card.textContent).toContain("82");
      expect(card.textContent).toContain("74");
    });

    expect(screen.getByTestId("mood-sparkline")).toBeTruthy();
    expect(card.textContent).toContain("칭찬");
    expect(card.textContent).toContain("협업");
  });

  it("AC-3[P0]: report-card 하단에 ai-badge(\"AI가 생성한 결과입니다\")를 항상 표시한다", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...REPORT });

    await renderReport();

    await waitFor(() => {
      expect(screen.getByTestId("report-view-button")).toBeTruthy();
    });
    screen.getByTestId("report-view-button").click();

    await waitFor(() => {
      expect(screen.getByTestId("ai-badge")).toBeTruthy();
    });

    expect(screen.getByTestId("ai-badge").textContent).toContain("AI가 생성한 결과입니다");
    expect(screen.getByTestId("report-card").contains(screen.getByTestId("ai-badge"))).toBe(true);
  });

  it("AC-4[P1]: 리포트 API 대기 중에는 Skeleton을 표시하고 버튼/카드는 렌더하지 않는다", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");
    let resolveReport!: (v: typeof REPORT) => void;
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise((resolve) => { resolveReport = resolve; }),
    );

    await renderReport();

    expect(document.querySelectorAll('[data-skeleton="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByTestId("report-view-button")).toBeNull();
    expect(screen.queryByTestId("report-card")).toBeNull();

    resolveReport({ ...REPORT });
    await waitFor(() => {
      expect(screen.getByTestId("report-view-button")).toBeTruthy();
    });
  });

  it("AC-5[P1]: 지난 주 리포트가 없으면(null) 빈 상태를 표시한다", async () => {
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await renderReport();

    await waitFor(() => {
      expect(screen.getByText(/이번 주 리포트가 아직 준비되지 않았어요/)).toBeTruthy();
    });

    expect(screen.queryByTestId("report-view-button")).toBeNull();
    expect(screen.queryByTestId("report-card")).toBeNull();
  });

  it("AC-6[P1]: 광고를 끝까지 보지 않고 닫으면 리포트 대신 안내 토스트를 표시한다", async () => {
    const sdk = await import("@apps-in-toss/web-framework");
    vi.mocked(sdk.showFullScreenAd).mockImplementationOnce(
      ((opts: { onEvent?: (e: { type: string }) => void }) => {
        setTimeout(() => opts.onEvent?.({ type: "dismissed" }), 0);
      }) as unknown as typeof sdk.showFullScreenAd,
    );
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...REPORT });

    await renderReport();

    await waitFor(() => {
      expect(screen.getByTestId("report-view-button")).toBeTruthy();
    });
    screen.getByTestId("report-view-button").click();

    await waitFor(() => {
      expect(screen.getByText(/광고를 끝까지 보면 리포트를 볼 수 있어요/)).toBeTruthy();
    });

    expect(screen.queryByTestId("report-card")).toBeNull();
    expect(screen.getByTestId("report-view-button")).toBeTruthy();
  });

  it("AC-7[P0]: AI 생성형 고지는 아직 확인하지 않았을 때만 표시되고, 닫으면 ackAiNotice가 호출된다", async () => {
    profileMock.aiNoticeAck = false;
    const { fetchWeeklyReport } = await import("@/lib/api/endpoints");
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...REPORT });

    await renderReport();

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeTruthy();
    });
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("생성형 AI");

    screen.getByRole("button", { name: "닫기" }).click();
    expect(profileMock.ackAiNotice).toHaveBeenCalledTimes(1);

    cleanup();
    profileMock.aiNoticeAck = true;
    (fetchWeeklyReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...REPORT });

    await renderReport();

    await waitFor(() => {
      expect(screen.getByTestId("report-view-button")).toBeTruthy();
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
