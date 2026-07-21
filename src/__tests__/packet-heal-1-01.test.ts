import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";

mockAll();

const PROFILE = {
  userId: "u1",
  teamId: "t1",
  teamName: "디자인팀",
  nickname: "민지",
  joinedAt: 1750000000000,
};

const SRC_ROOT = path.resolve(__dirname, "..");
const ROUTE_PATHS = ["/", "/onboarding", "/feed", "/leaderboard", "/report"];

// Recursively collect every .ts/.tsx source file under src/, excluding
// __tests__ (test files legitimately reference route strings/markup).
function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "__tests__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const sourceFiles = collectSourceFiles(SRC_ROOT).map((f) => ({
  path: f,
  content: fs.readFileSync(f, "utf-8"),
}));

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ error: "네트워크 연결을 확인해주세요" }),
    text: async () => "",
  }) as unknown as typeof fetch;
});

describe("0015-heal-1-01 라우팅/Provider 중복 배선 제거 및 단일 진입점 정합", () => {
  it("AC-1[P0]: 각 페이지 라우트(/, /onboarding, /feed, /leaderboard, /report)는 소스 전체에서 정확히 한 곳에서만 <Route path>로 등록된다", () => {
    for (const routePath of ROUTE_PATHS) {
      const pattern = new RegExp(`<Route[^>]*path=["']${routePath.replace("/", "\\/")}["']`, "g");
      const matchingFiles = sourceFiles.filter((f) => pattern.test(f.content));
      expect(matchingFiles.length).toBe(1);
      expect(matchingFiles[0]?.path.endsWith("App.tsx")).toBe(true);
    }
  });

  it("AC-1[P0]: 소스 전체에서 <Routes> 라우트 테이블 선언은 정확히 1개뿐이다 (router.tsx 등 중복 라우터 파일 없음)", () => {
    const filesWithRoutesTable = sourceFiles.filter((f) => /<Routes[\s>]/.test(f.content));
    expect(filesWithRoutesTable.length).toBe(1);
    expect(filesWithRoutesTable[0]?.path.endsWith("App.tsx")).toBe(true);

    // 별도 router.tsx / routes/index.tsx 로 라우트 테이블을 쪼개 중복 배선하지 않는다.
    expect(fs.existsSync(path.join(SRC_ROOT, "router.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(SRC_ROOT, "routes", "index.tsx"))).toBe(false);
  });

  it("AC-2[P0]: ProfileProvider와 TDSMobileAITProvider는 앱 트리를 각각 정확히 한 번만 감싼다", () => {
    const filesWrappingProfileProvider = sourceFiles.filter((f) =>
      /<ProfileProvider[\s>]/.test(f.content),
    );
    expect(filesWrappingProfileProvider.length).toBe(1);
    expect(filesWrappingProfileProvider[0]?.path.endsWith("App.tsx")).toBe(true);

    const filesWrappingAitProvider = sourceFiles.filter((f) =>
      /<TDSMobileAITProvider[\s>]/.test(f.content),
    );
    expect(filesWrappingAitProvider.length).toBe(1);
    expect(filesWrappingAitProvider[0]?.path.endsWith("main.tsx")).toBe(true);
  });

  it("AC-2[P0]: 렌더된 앱에서 useProfile()이 크래시 없이 동작한다 (Provider가 최소 한 번은 감싸고 있음을 방증)", async () => {
    const App = (await import("@/App")).default;
    seedLocalStorage({ "teampulse:profile": PROFILE });

    renderWithRouter(React.createElement(App), { initialEntries: ["/"] });

    await waitFor(() => expect(screen.getByText("오늘의 미션").textContent).toBe("오늘의 미션"));
    expect(screen.getByRole("tablist", { name: "메인 네비게이션" })).not.toBeNull();
  });

  it("AC-3[P0]: RequireProfile 가드, FloatingTabBar, checkTossSession은 각각 정확히 한 곳에서만 정의되며 App.tsx는 재정의 없이 import해서 재사용한다", () => {
    const filesDefiningFloatingTabBar = sourceFiles.filter((f) =>
      /export function FloatingTabBar/.test(f.content),
    );
    expect(filesDefiningFloatingTabBar.length).toBe(1);
    expect(filesDefiningFloatingTabBar[0]?.path.endsWith("components/FloatingTabBar.tsx")).toBe(
      true,
    );

    const filesDefiningCheckTossSession = sourceFiles.filter((f) =>
      /export (async )?function checkTossSession/.test(f.content),
    );
    expect(filesDefiningCheckTossSession.length).toBe(1);
    expect(filesDefiningCheckTossSession[0]?.path.endsWith("lib/sessionCheck.ts")).toBe(true);

    const filesDefiningRequireProfileGuard = sourceFiles.filter((f) =>
      /function RequireProfile/.test(f.content),
    );
    expect(filesDefiningRequireProfileGuard.length).toBe(1);
    expect(filesDefiningRequireProfileGuard[0]?.path.endsWith("App.tsx")).toBe(true);

    const appSource = fs.readFileSync(path.join(SRC_ROOT, "App.tsx"), "utf-8");
    expect(appSource).toMatch(/import\s*{\s*FloatingTabBar\s*}\s*from\s*['"]\.\/components\/FloatingTabBar['"]/);
    expect(appSource).toMatch(/import\s*{\s*checkTossSession\s*}\s*from\s*['"]\.\/lib\/sessionCheck['"]/);
  });

  it("AC-4[P0]: 프로필이 있는 유저가 모든 탭 라우트를 방문해도 console.error가 0회 호출된다", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const App = (await import("@/App")).default;
    seedLocalStorage({ "teampulse:profile": PROFILE });

    for (const route of ["/", "/feed", "/leaderboard", "/report"]) {
      const { unmount } = renderWithRouter(React.createElement(App), {
        initialEntries: [route],
      });
      await waitFor(() =>
        expect(screen.getByRole("tablist", { name: "메인 네비게이션" })).not.toBeNull(),
      );
      unmount();
    }

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("AC-4[P0]: main.tsx는 @AI:ANCHOR 표시가 있는 단일 진입점이며 App을 정확히 한 번만 렌더한다", () => {
    const mainSource = fs.readFileSync(path.join(SRC_ROOT, "main.tsx"), "utf-8");

    expect(mainSource).toContain("@AI:ANCHOR");
    const appRenderMatches = mainSource.match(/<App\s*\/>/g) ?? [];
    expect(appRenderMatches.length).toBe(1);
    expect(mainSource).toMatch(/import App from ['"]\.\/App['"]/);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
