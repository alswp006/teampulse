import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { UserProfile } from "@/lib/types";
import { keys } from "@/lib/types";

/**
 * PACKET 0003: ProfileContext + AI 고지 상태 관리
 *
 * TDD Phase: Tests are written FIRST. The implementation (src/lib/profileContext.tsx)
 * does not exist yet. These tests WILL FAIL until it is implemented.
 *
 * Expected exports from src/lib/profileContext.tsx:
 * - ProfileProvider: React component — on mount, loads profile + aiNoticeAck flag from
 *   src/lib/storage.ts (getProfile()/getAiNoticeAck()) and exposes them via context.
 * - useProfile(): hook returning { profile, setProfileAndPersist, aiNoticeAck, ackAiNotice }
 *   - profile: UserProfile | null
 *   - setProfileAndPersist(profile: UserProfile): void — persists via storage.setProfile()
 *     AND updates context state so subscribers re-render
 *   - aiNoticeAck: boolean
 *   - ackAiNotice(): void — persists via storage.setAiNoticeAck() (teampulse:ai_notice_ack="true")
 *     AND updates context state
 * - useProfile() called outside a ProfileProvider throws a clear, descriptive error
 *
 * AC-1 [P0]: useProfile()로 profile 구독 가능, setProfileAndPersist() 호출 시 storage+context 동시 갱신
 * AC-2 [P0]: ackAiNotice()가 teampulse:ai_notice_ack="true" 저장 + 상태 반영
 * AC-3 [P0]: Provider 없이 사용 시 명확한 에러 throw, 컴파일 유지
 */

const testProfile: UserProfile = {
  userId: "u001",
  teamId: "team-42",
  teamName: "프로덕트팀",
  nickname: "설레는판다",
  joinedAt: 1719000000000,
};

type UseProfileHook = typeof import("@/lib/profileContext").useProfile;

// Consumer factory — takes the real useProfile hook (loaded dynamically since
// src/lib/profileContext.tsx does not exist yet in the TDD red phase).
function makeProfileConsumer(useProfile: UseProfileHook) {
  return function ProfileConsumer() {
    const { profile, setProfileAndPersist, aiNoticeAck, ackAiNotice } = useProfile();
    return React.createElement(
      "div",
      null,
      React.createElement("span", { "data-testid": "profile-nickname" }, profile?.nickname ?? "none"),
      React.createElement("span", { "data-testid": "ai-notice-ack" }, String(aiNoticeAck)),
      React.createElement(
        "button",
        { onClick: () => setProfileAndPersist(testProfile) },
        "set-profile",
      ),
      React.createElement("button", { onClick: () => ackAiNotice() }, "ack-ai-notice"),
    );
  };
}

describe("AC-1: ProfileContext subscription + persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-1a[P0]: useProfile() exposes null profile when nothing stored, then updates via setProfileAndPersist()", async () => {
    const { ProfileProvider, useProfile } = await import("@/lib/profileContext");
    const ProfileConsumer = makeProfileConsumer(useProfile);

    render(
      React.createElement(ProfileProvider, null, React.createElement(ProfileConsumer)),
    );

    expect(screen.getByTestId("profile-nickname").textContent).toBe("none");

    fireEvent.click(screen.getByText("set-profile"));

    expect(screen.getByTestId("profile-nickname").textContent).toBe("설레는판다");
  });

  it("AC-1b[P0]: setProfileAndPersist() writes profile to storage under keys.profile", async () => {
    const { ProfileProvider, useProfile } = await import("@/lib/profileContext");
    const ProfileConsumer = makeProfileConsumer(useProfile);

    render(
      React.createElement(ProfileProvider, null, React.createElement(ProfileConsumer)),
    );

    fireEvent.click(screen.getByText("set-profile"));

    const stored = localStorage.getItem(keys.profile);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(testProfile);
  });

  it("AC-1c: ProfileProvider loads an existing profile from storage on mount", async () => {
    localStorage.setItem(keys.profile, JSON.stringify(testProfile));

    const { ProfileProvider, useProfile } = await import("@/lib/profileContext");
    const ProfileConsumer = makeProfileConsumer(useProfile);

    render(
      React.createElement(ProfileProvider, null, React.createElement(ProfileConsumer)),
    );

    expect(screen.getByTestId("profile-nickname").textContent).toBe("설레는판다");
  });
});

describe("AC-2: AI 고지 ack flag", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-2a[P0]: aiNoticeAck defaults to false when teampulse:ai_notice_ack is not set", async () => {
    const { ProfileProvider, useProfile } = await import("@/lib/profileContext");
    const ProfileConsumer = makeProfileConsumer(useProfile);

    render(
      React.createElement(ProfileProvider, null, React.createElement(ProfileConsumer)),
    );

    expect(screen.getByTestId("ai-notice-ack").textContent).toBe("false");
    expect(localStorage.getItem(keys.aiNoticeAck)).toBeNull();
  });

  it("AC-2b[P0]: ackAiNotice() stores teampulse:ai_notice_ack='true' and updates context state", async () => {
    const { ProfileProvider, useProfile } = await import("@/lib/profileContext");
    const ProfileConsumer = makeProfileConsumer(useProfile);

    render(
      React.createElement(ProfileProvider, null, React.createElement(ProfileConsumer)),
    );

    fireEvent.click(screen.getByText("ack-ai-notice"));

    expect(localStorage.getItem(keys.aiNoticeAck)).toBe("true");
    expect(screen.getByTestId("ai-notice-ack").textContent).toBe("true");
  });

  it("AC-2c: ProfileProvider loads aiNoticeAck=true from storage on mount when already acknowledged", async () => {
    localStorage.setItem(keys.aiNoticeAck, "true");

    const { ProfileProvider, useProfile } = await import("@/lib/profileContext");
    const ProfileConsumer = makeProfileConsumer(useProfile);

    render(
      React.createElement(ProfileProvider, null, React.createElement(ProfileConsumer)),
    );

    expect(screen.getByTestId("ai-notice-ack").textContent).toBe("true");
  });
});

describe("AC-3: useProfile() outside ProfileProvider throws", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("AC-3a[P0]: rendering a useProfile() consumer without ProfileProvider throws a descriptive error", async () => {
    const { useProfile } = await import("@/lib/profileContext");
    const ProfileConsumer = makeProfileConsumer(useProfile);

    expect(() => {
      render(React.createElement(ProfileConsumer));
    }).toThrow(/ProfileProvider/i);
  });

  it("AC-3b: the thrown error is a real Error instance with a non-empty message", async () => {
    const { useProfile } = await import("@/lib/profileContext");
    const ProfileConsumer = makeProfileConsumer(useProfile);

    let caught: unknown = null;
    try {
      render(React.createElement(ProfileConsumer));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message.length).toBeGreaterThan(0);
  });
});
