import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";

/**
 * PACKET 0006: 온보딩 페이지 /onboarding
 *
 * TDD Phase: Tests are written FIRST. The implementation (src/pages/Onboarding.tsx)
 * does not exist yet. These tests WILL FAIL until it is implemented.
 *
 * Expected behavior of src/pages/Onboarding.tsx:
 * - ScreenScaffold + Top + 팀 코드/닉네임 TextField(placeholder 필수) + 하단 고정 SubmitFooter
 * - 제출 시 joinTeam(teamCode, nickname) 호출
 *   - 성공: setProfileAndPersist({ userId, teamId, teamName, nickname, joinedAt }) 저장,
 *     성공 Toast "{teamName}에 참여했어요" 표시, navigate('/', { replace: true })
 *     그리고 amount<=5000 검증을 통과한 경우에만 grantPromotionReward({ promotionCode, amount }) 호출
 *   - 실패(404 등): 에러 메시지를 화면에 표시하고 전환하지 않는다
 * - 닉네임이 공백이면 joinTeam을 호출하지 않고 TextField 하단(role=alert)에 "닉네임을 입력해주세요" 표시
 * - 제출 중에는 버튼이 disabled(로딩)되어 중복 클릭을 차단한다
 *
 * AC-1 [P0]: 성공 시 프로필 저장·성공 토스트·'/'로 replace 이동
 * AC-2 [P0]: 닉네임 공백 시 API 미호출 + TextField 하단 에러, 404 시 에러 표시 후 전환 안 함
 * AC-3 [P0]: 제출 중 버튼 loading+disabled로 중복 차단, amount<=5000 검증 통과 시에만 grantPromotionReward 호출
 */

mockAll();

vi.mock("@/lib/api/endpoints", () => ({
  joinTeam: vi.fn(),
}));

const mockSetProfileAndPersist = vi.fn();
vi.mock("@/lib/profileContext", () => ({
  useProfile: () => ({
    profile: null,
    setProfileAndPersist: mockSetProfileAndPersist,
    aiNoticeAck: true,
    ackAiNotice: vi.fn(),
  }),
}));

async function renderOnboarding() {
  const { default: Onboarding } = await import("@/pages/Onboarding");
  renderWithRouter(React.createElement(Onboarding));
}

async function fillAndSubmit(teamCode: string, nickname: string) {
  if (teamCode !== undefined) {
    fireEvent.change(screen.getByPlaceholderText(/팀 코드/), { target: { value: teamCode } });
  }
  if (nickname !== undefined) {
    fireEvent.change(screen.getByPlaceholderText(/닉네임/), { target: { value: nickname } });
  }
  fireEvent.click(screen.getByRole("button", { name: /참여/ }));
}

describe("온보딩 페이지 /onboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    mockSetProfileAndPersist.mockClear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("AC-1[P0]: 팀 참여 성공", () => {
    it("AC-1a[P0]: 성공 시 프로필을 저장하고 성공 토스트를 표시하고 '/'로 replace 이동한다", async () => {
      const { joinTeam } = await import("@/lib/api/endpoints");
      (joinTeam as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        userId: "u1",
        teamId: "t1",
        teamName: "디자인팀",
      });

      await renderOnboarding();
      await fillAndSubmit("PULSE24", "민지");

      await waitFor(() => {
        expect(mockSetProfileAndPersist).toHaveBeenCalledTimes(1);
      });

      const savedProfile = mockSetProfileAndPersist.mock.calls[0][0];
      expect(savedProfile.userId).toBe("u1");
      expect(savedProfile.teamId).toBe("t1");
      expect(savedProfile.teamName).toBe("디자인팀");
      expect(savedProfile.nickname).toBe("민지");

      expect(joinTeam).toHaveBeenCalledWith("PULSE24", "민지");
      expect(screen.getByText("디자인팀에 참여했어요").textContent).toBe("디자인팀에 참여했어요");
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    it("AC-1b[P0]: 실패 시(팀 코드 오류) 프로필을 저장하지 않고 이동하지 않는다", async () => {
      const { joinTeam } = await import("@/lib/api/endpoints");
      (joinTeam as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("존재하지 않는 팀 코드예요"),
      );

      await renderOnboarding();
      await fillAndSubmit("WRONG", "민지");

      await waitFor(() => {
        expect(screen.getByText("존재하지 않는 팀 코드예요").textContent).toBe(
          "존재하지 않는 팀 코드예요",
        );
      });

      expect(mockSetProfileAndPersist).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("AC-2[P0]: 입력 검증 + 서버 에러", () => {
    it("AC-2a[P0]: 닉네임이 공백이면 API를 호출하지 않고 TextField 하단에 에러를 표시한다", async () => {
      const { joinTeam } = await import("@/lib/api/endpoints");

      await renderOnboarding();
      await fillAndSubmit("PULSE24", "");

      expect(joinTeam).not.toHaveBeenCalled();
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("닉네임을 입력해주세요");
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("AC-2b[P0]: 서버 404 에러 메시지를 화면에 표시하고 화면 전환을 하지 않는다", async () => {
      const { joinTeam } = await import("@/lib/api/endpoints");
      (joinTeam as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("존재하지 않는 팀 코드예요"),
      );

      await renderOnboarding();
      await fillAndSubmit("WRONG", "민지");

      await waitFor(() => {
        expect(screen.getByText("존재하지 않는 팀 코드예요").textContent).toBe(
          "존재하지 않는 팀 코드예요",
        );
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      // 입력값이 유지되어 재제출 가능해야 한다
      expect((screen.getByPlaceholderText(/팀 코드/) as HTMLInputElement).value).toBe("WRONG");
    });
  });

  describe("AC-3[P0]: 제출 중 로딩 차단 + 프로모션 한도 검증", () => {
    it("AC-3a[P0]: 제출 중 버튼이 disabled 되어 중복 클릭 시 joinTeam이 한 번만 호출된다", async () => {
      const { joinTeam } = await import("@/lib/api/endpoints");
      let resolveJoin: (value: { userId: string; teamId: string; teamName: string }) => void;
      (joinTeam as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveJoin = resolve;
          }),
      );

      await renderOnboarding();
      fireEvent.change(screen.getByPlaceholderText(/팀 코드/), { target: { value: "PULSE24" } });
      fireEvent.change(screen.getByPlaceholderText(/닉네임/), { target: { value: "민지" } });

      const button = screen.getByRole("button", { name: /참여/ }) as HTMLButtonElement;
      fireEvent.click(button);

      expect(button.disabled).toBe(true);

      fireEvent.click(button);
      expect(joinTeam).toHaveBeenCalledTimes(1);

      resolveJoin!({ userId: "u1", teamId: "t1", teamName: "디자인팀" });
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true }));
    });

    it("AC-3b[P0]: 참여 성공 시 amount<=5000 검증을 통과한 경우에만 grantPromotionReward를 호출한다", async () => {
      const { joinTeam } = await import("@/lib/api/endpoints");
      const { grantPromotionReward } = await import("@apps-in-toss/web-framework");
      (joinTeam as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        userId: "u1",
        teamId: "t1",
        teamName: "디자인팀",
      });

      await renderOnboarding();
      await fillAndSubmit("PULSE24", "민지");

      await waitFor(() => expect(mockNavigate).toHaveBeenCalled());

      expect(grantPromotionReward).toHaveBeenCalledTimes(1);
      const call = (grantPromotionReward as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof call.promotionCode).toBe("string");
      expect(call.promotionCode.length).toBeGreaterThan(0);
      expect(call.amount).toBeGreaterThan(0);
      expect(call.amount).toBeLessThanOrEqual(5000);
    });

    it("AC-3c[P0]: 참여 실패 시 grantPromotionReward를 호출하지 않는다", async () => {
      const { joinTeam } = await import("@/lib/api/endpoints");
      const { grantPromotionReward } = await import("@apps-in-toss/web-framework");
      (joinTeam as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("존재하지 않는 팀 코드예요"),
      );

      await renderOnboarding();
      await fillAndSubmit("WRONG", "민지");

      await waitFor(() => {
        expect(screen.getByText("존재하지 않는 팀 코드예요").textContent).toBe(
          "존재하지 않는 팀 코드예요",
        );
      });

      expect(grantPromotionReward).not.toHaveBeenCalled();
    });
  });
});
