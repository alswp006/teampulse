import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { keys, type UserProfile } from "@/lib/types";

/**
 * PACKET 0014: 배너 광고 배치 + AI 고지 전역 정합 + 최종 UX 폴리시
 *
 * TDD Phase: Tests are written FIRST. src/components/BannerSection.tsx does not
 * yet exist and src/App.tsx does not yet wire it in. These tests WILL FAIL until
 * implemented.
 *
 * Expected behavior:
 * - src/components/BannerSection.tsx: a data-testid="banner-section" wrapper
 *   around AdSlot, rendered as a standalone section (no hardcoded HEX colors).
 * - Home (`/`): banner renders as its own section, not nested inside the
 *   mission-card Card or inside the response textarea wrapper, positioned
 *   after the mission card and before the input form (spec S2 contract).
 * - AI notice (aiNoticeAck, keys.aiNoticeAck / @/lib/profileContext) is a single
 *   source of truth: acking it from ANY entry path (Home's AI recommend trigger,
 *   or Report's auto-shown dialog) must prevent it from showing again from the
 *   OTHER entry path, across fresh mounts (app lifecycle, not just component state).
 * - Zero console.error during Home render; BannerSection has no hardcoded HEX.
 *
 * AC-1 [P0]: 배너가 미션 카드/응답 폼과 겹치지 않음 (별도 섹션, DOM 순서: 미션 카드 → 배너 → 입력 폼)
 * AC-2 [P0]: AI 고지 다이얼로그 앱 생애주기 1회 (홈/리포트 어느 경로로 진입해도 중복 노출 없음)
 * AC-3 [P1]: console.error 0개 + HEX 색상 하드코딩 없음
 */

mockAll();

const TEAM_ID = "team-growth";
const PROFILE: UserProfile = {
  userId: "u1",
  teamId: TEAM_ID,
  teamName: "성장팀",
  nickname: "민제",
  joinedAt: 1700000000000,
};

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

const REPORT = {
  teamId: TEAM_ID,
  weekStart: "2026-07-13",
  participationRate: 82,
  moodScore: 74,
  moodTrend: [60, 65, 70, 68, 72, 74, 74],
  positiveKeywords: ["칭찬", "협업"],
  summary: "이번 주는 칭찬이 늘었어요",
  generatedByAI: true as const,
};

vi.mock("@/lib/api/endpoints", () => ({
  fetchTodayMission: vi.fn(async () => MISSION),
  fetchWeeklyReport: vi.fn(async () => REPORT),
  recommendMission: vi.fn(async () => ({
    mission: MISSION,
    moodScore: 70,
    rationale: "최근 팀 대화가 활발해요",
  })),
}));

function seedProfile() {
  seedLocalStorage({ [keys.profile]: PROFILE });
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error("network unavailable"));
});

describe("배너 광고 배치 + AI 고지 전역 정합 + 최종 UX 폴리시", () => {
  describe("AC-1: 배너가 미션 카드/응답 폼과 겹치지 않음", () => {
    it("AC-1[P0]: BannerSection은 별도의 data-testid=banner-section 섹션에 AdSlot을 담아 렌더한다", async () => {
      const { BannerSection } = await import("@/components/BannerSection");
      const { container } = renderWithRouter(React.createElement(BannerSection));

      const banner = screen.getByTestId("banner-section");
      expect(banner).toBeTruthy();
      // AdSlot renders a div carrying data-ad-group-id — must be present inside the section.
      expect(container.querySelector("[data-ad-group-id]")).toBeTruthy();
    });

    it("AC-1[P0]: 홈 화면에서 배너는 미션 카드/응답 폼과 겹치지 않고, 미션 카드 뒤·입력 폼 앞에 위치한다", async () => {
      seedProfile();
      const { default: App } = await import("@/App");
      renderWithRouter(React.createElement(App), { initialEntries: ["/"] });

      await screen.findByTestId("mission-card");
      const banner = await screen.findByTestId("banner-section");
      const missionCard = screen.getByTestId("mission-card");
      const responseWrapper = await screen.findByTestId("response-textarea-wrapper");

      // Not nested inside one another — a sibling section, not an overlap.
      expect(missionCard.contains(banner)).toBe(false);
      expect(banner.contains(missionCard)).toBe(false);
      expect(responseWrapper.contains(banner)).toBe(false);
      expect(banner.contains(responseWrapper)).toBe(false);

      // DOM order: mission card comes before the banner, banner comes before the input form.
      const missionThenBanner = missionCard.compareDocumentPosition(banner);
      const bannerThenForm = banner.compareDocumentPosition(responseWrapper);
      expect(missionThenBanner & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(bannerThenForm & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe("AC-2: AI 고지 다이얼로그 앱 생애주기 1회", () => {
    it("AC-2[P0]: 홈에서 AI 고지를 확인하면 aiNoticeAck가 저장되고, 이후 리포트에 진입해도 고지가 다시 뜨지 않는다", async () => {
      seedProfile();
      const { default: App } = await import("@/App");

      const home = renderWithRouter(React.createElement(App), { initialEntries: ["/"] });
      await screen.findByTestId("mission-card");

      fireEvent.click(screen.getByRole("button", { name: /AI 추천 미션 받기/ }));
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByRole("button", { name: "확인" }));

      await waitFor(() => {
        expect(localStorage.getItem(keys.aiNoticeAck)).toBe("true");
      });
      expect(dialog).toBeTruthy();
      home.unmount();

      // Fresh mount at a different entry path — the ack must persist app-wide.
      const report = renderWithRouter(React.createElement(App), { initialEntries: ["/report"] });
      await screen.findByTestId("report-card").catch(() => screen.findByTestId("ai-badge"));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      report.unmount();
    });

    it("AC-2[P0]: 리포트에서 먼저 고지를 닫으면, 홈의 AI 추천 트리거는 별도 고지 없이 바로 실행된다", async () => {
      seedProfile();
      // getAiNoticeAck()/setAiNoticeAck() (src/lib/storage.ts) store the raw string "true",
      // not JSON — set it directly rather than via the JSON.stringify'ing seedLocalStorage.
      localStorage.setItem(keys.aiNoticeAck, "true");

      const { default: App } = await import("@/App");
      renderWithRouter(React.createElement(App), { initialEntries: ["/"] });

      await screen.findByTestId("mission-card");
      fireEvent.click(screen.getByRole("button", { name: /AI 추천 미션 받기/ }));

      // No notice dialog this time — already acked via the report entry path.
      expect(screen.queryByRole("alertdialog")).toBeNull();
      await waitFor(() => {
        expect(screen.getByTestId("ai-recommend-card")).toBeTruthy();
      });
    });
  });

  describe("AC-3: 최종 UX 폴리시 (console.error 0개, HEX 하드코딩 금지)", () => {
    it("AC-3[P1]: 홈 화면 렌더링 중 console.error가 호출되지 않는다", async () => {
      seedProfile();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { default: App } = await import("@/App");

      renderWithRouter(React.createElement(App), { initialEntries: ["/"] });
      await screen.findByTestId("mission-card");
      await screen.findByTestId("banner-section");

      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("AC-3: BannerSection은 인라인 style에 HEX 색상을 하드코딩하지 않는다", async () => {
      const { BannerSection } = await import("@/components/BannerSection");
      const { container } = renderWithRouter(React.createElement(BannerSection));

      const banner = screen.getByTestId("banner-section");
      const styleAttr = banner.getAttribute("style") ?? "";
      expect(/#[0-9a-fA-F]{3,8}/.test(styleAttr)).toBe(false);
      expect(container.querySelectorAll("[style*='#']").length).toBe(0);
    });
  });
});
