import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { keys, type UserProfile } from "@/lib/types";
import App from "@/App";
import { checkTossSession } from "@/lib/sessionCheck";

mockAll();

const PROFILE: UserProfile = {
  userId: "u1",
  teamId: "team-growth",
  teamName: "성장팀",
  nickname: "민제",
  joinedAt: 1700000000000,
};

function seedProfile() {
  seedLocalStorage({ [keys.profile]: PROFILE });
}

beforeEach(() => {
  // Home/Feed/Leaderboard/Report all fetch on mount — reject so they settle
  // into their error/empty branches instead of hanging on a real network call.
  globalThis.fetch = vi.fn().mockRejectedValue(new Error("network unavailable"));
});

describe("라우터 배선 + 온보딩 가드 + FloatingTabBar + Toss 세션 확인", () => {
  it("AC-1[P0]: 프로필이 없으면 / 진입 시 /onboarding으로 리다이렉트된다", async () => {
    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });
    expect(await screen.findByText("팀에 참여하기")).toBeTruthy();
    expect(screen.queryByText("오늘의 미션")).toBeNull();
  });

  it("AC-1[P0]: 프로필이 있으면 /는 온보딩을 건너뛰고 홈을 렌더한다", async () => {
    seedProfile();
    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });
    expect(await screen.findByText("오늘의 미션")).toBeTruthy();
    expect(screen.queryByText("팀에 참여하기")).toBeNull();
  });

  it("AC-1: 프로필이 있는 상태로 /onboarding에 직접 진입하면 /로 리다이렉트된다", async () => {
    seedProfile();
    renderWithRouter(React.createElement(App), { initialEntries: ["/onboarding"] });
    expect(await screen.findByText("오늘의 미션")).toBeTruthy();
    expect(screen.queryByText("팀에 참여하기")).toBeNull();
  });

  it("AC-2[P0]: checkTossSession은 SDK가 성공하면 true를 반환하고 SDK를 1회 호출한다", async () => {
    const sdk = await import("@apps-in-toss/web-framework");
    vi.mocked(sdk.getIsTossLoginIntegratedService).mockResolvedValueOnce(true);

    const result = await checkTossSession();

    expect(result).toBe(true);
    expect(sdk.getIsTossLoginIntegratedService).toHaveBeenCalledTimes(1);
  });

  it("AC-2[P0]: checkTossSession은 SDK가 예외를 던져도 크래시 없이 false를 반환한다", async () => {
    const sdk = await import("@apps-in-toss/web-framework");
    vi.mocked(sdk.getIsTossLoginIntegratedService).mockRejectedValueOnce(new Error("no bridge"));

    await expect(checkTossSession()).resolves.toBe(false);
    expect(sdk.getIsTossLoginIntegratedService).toHaveBeenCalledTimes(1);
  });

  it("AC-2: 앱 진입 시 getIsTossLoginIntegratedService가 1회 호출되고, 실패해도 홈이 정상 렌더된다", async () => {
    const sdk = await import("@apps-in-toss/web-framework");
    vi.mocked(sdk.getIsTossLoginIntegratedService).mockRejectedValueOnce(new Error("no bridge"));
    seedProfile();

    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });

    expect(await screen.findByText("오늘의 미션")).toBeTruthy();
    await waitFor(() =>
      expect(sdk.getIsTossLoginIntegratedService).toHaveBeenCalledTimes(1),
    );
  });

  it("AC-3: 온보딩 화면엔 탭바가 없고, 홈 화면엔 4탭 FloatingTabBar가 보인다", async () => {
    // 온보딩: 탭바 없음
    renderWithRouter(React.createElement(App), { initialEntries: ["/onboarding"] });
    await screen.findByText("팀에 참여하기");
    expect(screen.queryByRole("tab")).toBeNull();

    // 홈: 4탭
    seedProfile();
    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });
    await screen.findByText("오늘의 미션");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "홈" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "리포트" })).toBeTruthy();
  });

  it("Integration: 로그인된 유저의 모든 보호 라우트가 크래시 없이 렌더된다", async () => {
    seedProfile();
    const protectedPaths: Array<[string, string]> = [
      ["/", "오늘의 미션"],
      ["/feed", "팀 피드"],
      ["/leaderboard", "리더보드"],
      ["/report", "주간 리포트"],
    ];

    for (const [path, expectedTitle] of protectedPaths) {
      const { unmount } = renderWithRouter(React.createElement(App), {
        initialEntries: [path],
      });
      expect(await screen.findByText(expectedTitle)).toBeTruthy();
      unmount();
    }
  });
});
