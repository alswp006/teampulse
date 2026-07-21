import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import type { Mission } from "@/lib/types";

/**
 * PACKET 0008: 오늘의 미션 응답 폼 모듈 (입력·검증·draft·제출)
 *
 * TDD Phase: Tests are written FIRST. src/pages/home/ResponseForm.tsx does not
 * exist yet — these tests WILL FAIL until the Coder implements it (and wires
 * it into src/pages/Home.tsx).
 *
 * Expected contract of src/pages/home/ResponseForm.tsx:
 * - Named export `ResponseForm({ mission, onSubmitted }: { mission: Mission; onSubmitted: () => void })`.
 * - Renders a TDS `TextArea` (multiline) bound to local content state, initialized
 *   from `getDraft(mission.missionId)?.content ?? ""` (src/lib/storage.ts).
 * - Renders a visible char counter text `${content.length}/300`. Input longer than
 *   300 chars is clamped to 300 (component-enforced, not just native maxLength).
 * - When `mission.anonymous` is true, shows text containing "익명으로 등록돼요".
 *   When false, that text is not rendered.
 * - Submit control is a button with accessible name "응답 남기기". It is disabled
 *   whenever `content.trim() === ""` (including whitespace-only input).
 * - On every content change, calls `setDraft(mission.missionId, content)` so the
 *   draft auto-saves to `teampulse:draft:{missionId}` in localStorage.
 * - On submit: calls `createResponse(mission.missionId, content, mission.anonymous)`.
 *   On success: shows a Toast with text "응답을 남겼어요", calls
 *   `clearDraft(mission.missionId)` (removing the localStorage draft), calls
 *   `onSubmitted()`, and blurs the active element (keyboard dismiss).
 * - The textarea sits inside a wrapper with inline style minWidth/minHeight >= 44
 *   (touch target), per data-testid="response-textarea-wrapper".
 * - Zero console.error calls during any of the above.
 *
 * src/pages/Home.tsx wires this into the "미션 있음, 아직 참여 전" branch: passing
 * the loaded mission and an `onSubmitted` that flips the page into the same
 * "이미 참여했어요" state already covered by packet 0007 (via the
 * `teampulse:responded:{missionId}` localStorage flag).
 *
 * AC-1 [P0]: 익명 안내·빈값 거부·300자 카운터·draft 저장/복원
 * AC-2 [P0]: 제출 성공 토스트+clearDraft+onSubmitted 콜백, 제출 후 키보드 dismiss
 * AC-3 [P0]: 입력·버튼 ≥44px, console.error 0개
 */

mockAll();

const HOBBY_MISSION = {
  missionId: "m-hobby",
  teamId: "t1",
  date: "2026-07-22",
  type: "hobby" as const,
  title: "이번 주 취미 자랑하기",
  prompt: "요즘 빠진 취미가 있다면 알려주세요",
  anonymous: false,
  aiRecommended: false,
};

const WORRY_MISSION = {
  missionId: "m-worry",
  teamId: "t1",
  date: "2026-07-22",
  type: "worry" as const,
  title: "요즘 고민 나누기",
  prompt: "요즘 힘든 점이 있다면 편하게 적어보세요",
  anonymous: true,
  aiRecommended: false,
};

const RESPONSE = {
  responseId: "r-new",
  missionId: HOBBY_MISSION.missionId,
  userId: "u1",
  nickname: "민지",
  content: "등산 다녀왔어요",
  anonymous: false,
  reactions: 0,
  createdAt: 1234,
};

vi.mock("@/lib/api/endpoints", () => ({
  fetchTodayMission: vi.fn(),
  createResponse: vi.fn(),
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
    aiNoticeAck: true,
    ackAiNotice: vi.fn(),
  }),
}));

async function renderForm(mission: Mission = HOBBY_MISSION) {
  const onSubmitted = vi.fn();
  const { ResponseForm } = await import("@/pages/home/ResponseForm");
  renderWithRouter(React.createElement(ResponseForm, { mission, onSubmitted }));
  return { onSubmitted };
}

function draftKey(missionId: string) {
  return `teampulse:draft:${missionId}`;
}

function submitButton() {
  return screen.getByRole("button", { name: "응답 남기기" }) as HTMLButtonElement;
}

describe("오늘의 미션 응답 폼 모듈 (입력·검증·draft·제출)", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC-1[P0]: 익명 안내·빈값 거부·300자 카운터·draft 저장/복원", () => {
    it("AC-1a[P0]: worry(익명) 미션이면 '익명으로 등록돼요' 안내를 표시한다", async () => {
      await renderForm(WORRY_MISSION);

      expect(screen.getByText(/익명으로 등록돼요/).textContent).toContain(
        "익명으로 등록돼요",
      );
      expect(screen.getByRole("textbox")).toBeTruthy();
    });

    it("AC-1b[P0]: 익명이 아닌 미션에는 익명 안내가 없다", async () => {
      await renderForm(HOBBY_MISSION);

      expect(screen.queryByText(/익명으로 등록돼요/)).toBeNull();
    });

    it("AC-1c[P0]: 빈 값 또는 공백만 입력하면 제출 버튼이 비활성화된다", async () => {
      await renderForm();

      expect(submitButton().disabled).toBe(true);

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
      expect(submitButton().disabled).toBe(true);

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "실제 내용" } });
      expect(submitButton().disabled).toBe(false);
    });

    it("AC-1d[P0]: 글자수 카운터가 실시간으로 갱신되고 300자를 넘으면 300자로 잘린다", async () => {
      await renderForm();
      const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;

      expect(screen.getByText("0/300").textContent).toBe("0/300");

      fireEvent.change(textbox, { target: { value: "안녕하세요" } });
      expect(screen.getByText("5/300").textContent).toBe("5/300");

      const tooLong = "가".repeat(305);
      fireEvent.change(textbox, { target: { value: tooLong } });
      expect(textbox.value.length).toBe(300);
      expect(screen.getByText("300/300").textContent).toBe("300/300");
    });

    it("AC-1e[P0]: 입력 변경 시 draft가 localStorage에 자동 저장된다", async () => {
      localStorage.removeItem(draftKey(HOBBY_MISSION.missionId));
      await renderForm();

      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "저장 테스트 문구" },
      });

      const stored = JSON.parse(localStorage.getItem(draftKey(HOBBY_MISSION.missionId)) ?? "null");
      expect(stored).toEqual({ content: "저장 테스트 문구" });
    });

    it("AC-1f[P0]: 재진입 시 저장된 draft를 복원한다", async () => {
      localStorage.setItem(
        draftKey(HOBBY_MISSION.missionId),
        JSON.stringify({ content: "이어쓰는 응답" }),
      );

      await renderForm();

      const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textbox.value).toBe("이어쓰는 응답");
      expect(screen.getByText("6/300").textContent).toBe("6/300");
    });
  });

  describe("AC-2[P0]: 제출 성공 토스트+clearDraft+onSubmitted 콜백, 키보드 dismiss", () => {
    it("AC-2a[P0]: 제출 성공 시 createResponse가 정확한 값으로 호출되고 완료 토스트가 표시된다", async () => {
      const { createResponse } = await import("@/lib/api/endpoints");
      (createResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RESPONSE);

      await renderForm(WORRY_MISSION);
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "고민 있어요" } });
      fireEvent.click(submitButton());

      expect(createResponse).toHaveBeenCalledWith(
        WORRY_MISSION.missionId,
        "고민 있어요",
        true,
      );

      await waitFor(() => {
        expect(screen.getByText("응답을 남겼어요").textContent).toBe("응답을 남겼어요");
      });
    });

    it("AC-2b[P0]: 제출 성공 시 draft를 지우고 onSubmitted 콜백을 호출한다", async () => {
      localStorage.setItem(
        draftKey(HOBBY_MISSION.missionId),
        JSON.stringify({ content: "임시 저장본" }),
      );
      const { createResponse } = await import("@/lib/api/endpoints");
      (createResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RESPONSE);

      const { onSubmitted } = await renderForm(HOBBY_MISSION);
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "등산 다녀왔어요" } });
      fireEvent.click(submitButton());

      await waitFor(() => {
        expect(onSubmitted).toHaveBeenCalledTimes(1);
      });
      expect(localStorage.getItem(draftKey(HOBBY_MISSION.missionId))).toBeNull();
    });

    it("AC-2c[P1]: 제출 후 포커스를 해제해 키보드를 닫는다", async () => {
      const { createResponse } = await import("@/lib/api/endpoints");
      (createResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RESPONSE);

      await renderForm();
      const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
      fireEvent.change(textbox, { target: { value: "등산 다녀왔어요" } });
      textbox.focus();
      expect(document.activeElement).toBe(textbox);

      fireEvent.click(submitButton());

      await waitFor(() => {
        expect(document.activeElement).not.toBe(textbox);
      });
    });
  });

  describe("AC-3[P0]: 입력·버튼 ≥44px, console.error 0개", () => {
    it("AC-3a[P0]: 입력 영역은 최소 44x44px 터치 영역을 갖는다", async () => {
      await renderForm();

      const wrapper = screen.getByTestId("response-textarea-wrapper");
      const minWidth = parseInt(wrapper.style.minWidth || "0", 10);
      const minHeight = parseInt(wrapper.style.minHeight || "0", 10);
      expect(minWidth).toBeGreaterThanOrEqual(44);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    });

    it("AC-3b[P0]: 렌더링과 제출 과정에서 console.error가 호출되지 않는다", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { createResponse } = await import("@/lib/api/endpoints");
      (createResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RESPONSE);

      await renderForm();
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "정상 입력" } });
      fireEvent.click(submitButton());

      await waitFor(() => {
        expect(screen.getByText("응답을 남겼어요").textContent).toBe("응답을 남겼어요");
      });

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("Home 통합: 응답 폼 슬롯 연결", () => {
    it("참여 전 미션에는 응답 폼이 렌더되고, 제출 성공 시 '이미 참여했어요' 상태로 전환된다", async () => {
      localStorage.removeItem(`teampulse:responded:${HOBBY_MISSION.missionId}`);
      const { fetchTodayMission, createResponse } = await import("@/lib/api/endpoints");
      (fetchTodayMission as ReturnType<typeof vi.fn>).mockResolvedValueOnce(HOBBY_MISSION);
      (createResponse as ReturnType<typeof vi.fn>).mockResolvedValueOnce(RESPONSE);

      const { default: Home } = await import("@/pages/Home");
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("mission-card")).toBeTruthy();
      });
      expect(screen.getByRole("textbox")).toBeTruthy();

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "등산 다녀왔어요" } });
      fireEvent.click(screen.getByRole("button", { name: "응답 남기기" }));

      await waitFor(() => {
        expect(screen.getByText("이미 참여했어요").textContent).toBe("이미 참여했어요");
      });
      expect(localStorage.getItem(`teampulse:responded:${HOBBY_MISSION.missionId}`)).toBe(
        "true",
      );
    });
  });
});
