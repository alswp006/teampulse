import { test, expect } from '@playwright/test';

// nightcrew Sentinel smoke 팩 — Factory 산출(§7.1)
// 핵심 막: 매일 5분 마이크로 미션 (팀원끼리 취미 공유, 짧은 칭찬 릴레이, 익명 고민 상담 등), 비동기 참여 가능 (출근 시간 다르거나 시차 있어도 OK), 팀별 참여도 리더보드와 배지 시스템으로 게이미피케이션, AI가 팀 분위기 분석해서 적절한 미션 자동 추천 (긴장도 높으면 가벼운 미션), 주간 팀 리포트 (참여율, 긍정 키워드 분석, 팀 분위기 점수)
// 토스 브릿지 의존 구간(로그인·결제)은 외부 재현 불가 — 화면 도달 확인까지만.
const ROUTES = ["/","/Feed","/Home","/Leaderboard","/Onboarding"];
// WebView 밖 실행에서만 나는 콘솔 에러는 무시(앱인토스 관례 — toss visual-smoke 템플릿 계승)
const IGNORED_CONSOLE = [/SafeAreaInsets/i, /granite/i, /apps-in-toss/i];

for (const route of ROUTES) {
  test(`smoke: ${route} 렌더링과 콘솔 에러 없음`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(msg.text()))) errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
