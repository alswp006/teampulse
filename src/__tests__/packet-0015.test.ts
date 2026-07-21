import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";

mockAll();

// App.tsx wires its own ProfileProvider (not @/state/AppStateContext), so
// route-guard behavior is driven by real localStorage — seed it per-test.
const PROFILE = {
  userId: "u1",
  teamId: "t1",
  teamName: "디자인팀",
  nickname: "민지",
  joinedAt: 1750000000000,
};

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ error: "네트워크 연결을 확인해주세요" }),
    text: async () => "",
  }) as unknown as typeof fetch;
});

describe("라우팅 와이어링 + Provider 연결 + 통합 폴리시", () => {
  it("AC-1[P0]: App.tsx는 온보딩/홈/피드/리더보드/리포트 5개 페이지 Route를 모두 정의한다", async () => {
    const App = (await import("@/App")).default;

    // 프로필 없음 → RequireProfile이 /onboarding으로 리다이렉트하지 않고 온보딩 자체는 직접 접근 가능
    localStorage.clear();
    const { unmount: u1 } = renderWithRouter(
      React.createElement(App),
      { initialEntries: ["/onboarding"] },
    );
    expect(screen.getByText("팀에 참여하기").textContent).toBe("팀에 참여하기");
    u1();

    seedLocalStorage({ "teampulse:profile": PROFILE });

    const routeToTitle: Array<[string, string]> = [
      ["/", "오늘의 미션"],
      ["/feed", "팀 피드"],
      ["/leaderboard", "리더보드"],
      ["/report", "주간 리포트"],
    ];

    for (const [route, title] of routeToTitle) {
      const { unmount } = renderWithRouter(React.createElement(App), {
        initialEntries: [route],
      });
      await waitFor(() => expect(screen.getByText(title).textContent).toBe(title));
      unmount();
    }
  });

  it("AC-2[P0]: navigate() 대상 경로(홈→피드, 온보딩→홈)에 대응하는 Route가 존재한다", () => {
    const homeSource = fs.readFileSync(
      path.resolve(__dirname, "../pages/Home.tsx"),
      "utf-8",
    );
    const onboardingSource = fs.readFileSync(
      path.resolve(__dirname, "../pages/Onboarding.tsx"),
      "utf-8",
    );
    const appSource = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf-8");

    // Home.tsx는 navigate('/feed', ...) 호출
    expect(homeSource).toMatch(/navigate\(\s*['"]\/feed['"]/);
    // Onboarding.tsx는 navigate('/', ...) 호출
    expect(onboardingSource).toMatch(/navigate\(\s*['"]\/['"]/);

    // App.tsx가 두 경로 모두에 대응하는 Route를 정의
    expect(appSource).toMatch(/path=["']\/feed["']/);
    expect(appSource).toMatch(/path=["']\/["']/);
    expect(appSource).toMatch(/path=["']\/onboarding["']/);
  });

  it("AC-3[P0]: main.tsx는 TDSMobileAITProvider와 BrowserRouter를 유지한 채 App만 감싼다(@AI:ANCHOR 미수정)", () => {
    const mainSource = fs.readFileSync(path.resolve(__dirname, "../main.tsx"), "utf-8");

    expect(mainSource).toContain("@AI:ANCHOR");
    expect(mainSource).toContain("TDSMobileAITProvider");
    expect(mainSource).toContain("BrowserRouter");
    expect(mainSource).toMatch(/import App from ['"]\.\/App['"]/);
  });

  it("AC-4[P0]: 프로필이 있는 유저는 '/' 경로에서 앱이 크래시 없이 정상 렌더된다", async () => {
    const App = (await import("@/App")).default;
    seedLocalStorage({ "teampulse:profile": PROFILE });

    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });

    await waitFor(() => expect(screen.getByText("오늘의 미션").textContent).toBe("오늘의 미션"));
    // 하단 FloatingTabBar도 함께 렌더된다 (탭-루트 화면 골든 조합)
    expect(screen.getByRole("tablist", { name: "메인 네비게이션" })).not.toBeNull();
  });

  it("AC-4[P0]: 프로필이 없는 유저는 '/' 진입 시 온보딩으로 리다이렉트되어 크래시 없이 렌더된다", async () => {
    const App = (await import("@/App")).default;
    localStorage.clear();

    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });

    await waitFor(() =>
      expect(screen.getByText("팀에 참여하기").textContent).toBe("팀에 참여하기"),
    );
  });

  it("온보딩 화면에서는 하단 FloatingTabBar가 숨겨진다", async () => {
    const App = (await import("@/App")).default;
    localStorage.clear();

    renderWithRouter(React.createElement(App), { initialEntries: ["/onboarding"] });

    await waitFor(() =>
      expect(screen.getByText("팀에 참여하기").textContent).toBe("팀에 참여하기"),
    );
    expect(screen.queryByRole("tablist", { name: "메인 네비게이션" })).toBeNull();
  });
});
