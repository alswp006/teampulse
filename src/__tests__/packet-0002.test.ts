import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { UserProfile } from "@/lib/types";

/**
 * PACKET 0002: localStorage Helpers (Profile · Cache · Draft · AI Notice Flag)
 *
 * TDD Phase: Tests are written FIRST. The implementation (src/lib/storage.ts)
 * will be driven by these tests. These tests WILL FAIL until storage.ts is complete.
 *
 * Exported functions:
 * - getProfile() → UserProfile | null
 * - setProfile(profile: UserProfile) → void (swallows QuotaExceededError)
 * - clearProfile() → void
 * - readCache<T>(key: string) → T | null
 * - writeCache<T>(key: string, value: T) → void (swallows QuotaExceededError)
 * - getDraft(missionId: string) → { content: string } | null
 * - setDraft(missionId: string, content: string) → void (swallows QuotaExceededError)
 * - clearDraft(missionId: string) → void
 * - getAiNoticeAck() → boolean
 * - setAiNoticeAck() → void
 *
 * AC-1 [P0]: getProfile() returns profile object if exists, null otherwise
 * AC-2 [P0]: QuotaExceededError is caught silently; no throw, app continues
 * AC-3 [P0]: Only keys.* (from @/lib/types) used; no hardcoded keys; console.error = 0
 */

describe("AC-1: Profile CRUD", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-1a: getProfile() returns stored profile object when teampulse:profile exists", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const testProfile: UserProfile = {
      userId: "u123",
      teamId: "t456",
      teamName: "Design Team",
      nickname: "민지",
      joinedAt: 1704067200000, // 2024-01-01
    };

    // Pre-populate localStorage
    localStorage.setItem(keys.profile, JSON.stringify(testProfile));

    const result = storage.getProfile();
    expect(result).toEqual(testProfile);
    expect(result?.userId).toBe("u123");
    expect(result?.teamName).toBe("Design Team");
    expect(result?.nickname).toBe("민지");
  });

  it("AC-1b: getProfile() returns null when teampulse:profile does not exist", async () => {
    const storage = await import("@/lib/storage");

    const result = storage.getProfile();
    expect(result).toBeNull();
  });

  it("AC-1c: setProfile() stores profile in teampulse:profile key", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const testProfile: UserProfile = {
      userId: "u789",
      teamId: "t999",
      teamName: "Engineering",
      nickname: "John",
      joinedAt: 1704153600000,
    };

    storage.setProfile(testProfile);

    const stored = localStorage.getItem(keys.profile);
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!)).toEqual(testProfile);
  });

  it("AC-1d: clearProfile() removes teampulse:profile key", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const testProfile: UserProfile = {
      userId: "u111",
      teamId: "t222",
      teamName: "HR",
      nickname: "Alice",
      joinedAt: 1704240000000,
    };

    storage.setProfile(testProfile);
    expect(localStorage.getItem(keys.profile)).toBeDefined();

    storage.clearProfile();
    expect(localStorage.getItem(keys.profile)).toBeNull();
  });
});

describe("AC-2: QuotaExceededError Handling", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-2a: setProfile() catches QuotaExceededError and does not throw", async () => {
    const storage = await import("@/lib/storage");

    // Mock localStorage.setItem to throw QuotaExceededError
    const originalSetItem = localStorage.setItem;
    let callCount = 0;
    localStorage.setItem = vi.fn(() => {
      callCount++;
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    const testProfile: UserProfile = {
      userId: "u123",
      teamId: "t456",
      teamName: "Test",
      nickname: "Test",
      joinedAt: 123456,
    };

    // Should not throw
    expect(() => storage.setProfile(testProfile)).not.toThrow();
    expect(callCount).toBe(1);

    // Restore
    localStorage.setItem = originalSetItem;
  });

  it("AC-2b: writeCache() catches QuotaExceededError and does not throw", async () => {
    const storage = await import("@/lib/storage");

    // Mock localStorage.setItem to throw QuotaExceededError
    const originalSetItem = localStorage.setItem;
    let callCount = 0;
    localStorage.setItem = vi.fn(() => {
      callCount++;
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    // Should not throw
    expect(() => {
      storage.writeCache("test:key", { data: "value" });
    }).not.toThrow();
    expect(callCount).toBe(1);

    // Restore
    localStorage.setItem = originalSetItem;
  });

  it("AC-2c: setDraft() catches QuotaExceededError and does not throw", async () => {
    const storage = await import("@/lib/storage");

    // Mock localStorage.setItem to throw QuotaExceededError
    const originalSetItem = localStorage.setItem;
    let callCount = 0;
    localStorage.setItem = vi.fn(() => {
      callCount++;
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    });

    // Should not throw
    expect(() => {
      storage.setDraft("m123", "Response content");
    }).not.toThrow();
    expect(callCount).toBe(1);

    // Restore
    localStorage.setItem = originalSetItem;
  });

  it("AC-2d: app continues without crashing after quota exceeded", async () => {
    const storage = await import("@/lib/storage");

    // Mock localStorage.setItem to throw on first call only
    const originalSetItem = localStorage.setItem;
    let callCount = 0;
    localStorage.setItem = vi.fn((key, value) => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
      originalSetItem(key, value);
    });

    const testProfile: UserProfile = {
      userId: "u123",
      teamId: "t456",
      teamName: "Test",
      nickname: "Test",
      joinedAt: 123456,
    };

    // First call fails silently
    storage.setProfile(testProfile);

    // Second call (different function) should work normally
    storage.setAiNoticeAck();
    expect(localStorage.getItem("teampulse:ai_notice_ack")).toBe("true");

    // Restore
    localStorage.setItem = originalSetItem;
  });
});

describe("AC-3: Cache Key Helpers Only + No console.error", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("AC-3a: readCache() uses cacheKeys.* or keys.* from @/lib/types, not hardcoded strings", async () => {
    const storage = await import("@/lib/storage");
    const { cacheKeys } = await import("@/lib/types");

    const testMissionData = { missionId: "m1", title: "Test" };
    const cacheKey = cacheKeys.mission("2026-01-15");
    localStorage.setItem(cacheKey, JSON.stringify(testMissionData));

    // readCache should work with the key helper
    const result = storage.readCache(cacheKey);
    expect(result).toEqual(testMissionData);
  });

  it("AC-3b: writeCache() uses keys.* from @/lib/types", async () => {
    const storage = await import("@/lib/storage");
    const { cacheKeys } = await import("@/lib/types");

    const cacheKey = cacheKeys.feed("m456");
    const testData = [{ responseId: "r1", content: "Response" }];

    storage.writeCache(cacheKey, testData);

    const stored = localStorage.getItem(cacheKey);
    expect(JSON.parse(stored!)).toEqual(testData);
  });

  it("AC-3c: getDraft() uses keys.draft() from @/lib/types", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const missionId = "m789";
    const draftKey = keys.draft(missionId);
    const draftData = { content: "Draft response" };
    localStorage.setItem(draftKey, JSON.stringify(draftData));

    const result = storage.getDraft(missionId);
    expect(result).toEqual(draftData);
  });

  it("AC-3d: console.error is never called during normal operations", async () => {
    const storage = await import("@/lib/storage");
    const consoleError = vi.spyOn(console, "error");

    const testProfile: UserProfile = {
      userId: "u123",
      teamId: "t456",
      teamName: "Test",
      nickname: "Test",
      joinedAt: 123456,
    };

    storage.setProfile(testProfile);
    storage.getProfile();
    storage.setAiNoticeAck();
    storage.getAiNoticeAck();
    storage.readCache("test:key");
    storage.writeCache("test:key", { data: "value" });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("AC-3e: console.error is never called even when JSON parsing fails", async () => {
    const storage = await import("@/lib/storage");
    const consoleError = vi.spyOn(console, "error");
    const { keys } = await import("@/lib/types");

    // Store invalid JSON
    localStorage.setItem(keys.profile, "not-valid-json{");

    // readCache should handle gracefully
    const result = storage.readCache(keys.profile);
    expect(result).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();

    // getProfile should also handle gracefully
    const profile = storage.getProfile();
    expect(profile).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("Generic Cache API: readCache<T> / writeCache<T>", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("readCache<T>() returns stored object when key exists", async () => {
    const storage = await import("@/lib/storage");
    const { cacheKeys } = await import("@/lib/types");

    interface TestMission {
      missionId: string;
      title: string;
      type: "hobby" | "praise" | "worry" | "custom";
    }

    const testMission: TestMission = {
      missionId: "m1",
      title: "Share hobby",
      type: "hobby",
    };

    const key = cacheKeys.mission("2026-01-15");
    localStorage.setItem(key, JSON.stringify(testMission));

    const result = storage.readCache<TestMission>(key);
    expect(result).toEqual(testMission);
    expect(result?.missionId).toBe("m1");
    expect(result?.type).toBe("hobby");
  });

  it("readCache<T>() returns null when key does not exist", async () => {
    const storage = await import("@/lib/storage");

    const result = storage.readCache("nonexistent:key");
    expect(result).toBeNull();
  });

  it("readCache<T>() returns null when JSON is invalid", async () => {
    const storage = await import("@/lib/storage");

    localStorage.setItem("corrupted:key", "{invalid json");

    const result = storage.readCache("corrupted:key");
    expect(result).toBeNull();
  });

  it("writeCache<T>() stores typed object", async () => {
    const storage = await import("@/lib/storage");

    interface TestResponse {
      responseId: string;
      content: string;
      reactions: number;
    }

    const testResponse: TestResponse = {
      responseId: "r1",
      content: "Great work!",
      reactions: 5,
    };

    const key = "test:response";
    storage.writeCache<TestResponse>(key, testResponse);

    const stored = localStorage.getItem(key);
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!)).toEqual(testResponse);
  });

  it("writeCache<T>() works with arrays", async () => {
    const storage = await import("@/lib/storage");
    const { cacheKeys } = await import("@/lib/types");

    interface LeaderboardEntry {
      userId: string;
      rank: number;
    }

    const entries: LeaderboardEntry[] = [
      { userId: "u1", rank: 1 },
      { userId: "u2", rank: 2 },
      { userId: "u3", rank: 3 },
    ];

    const key = cacheKeys.leaderboard("t1");
    storage.writeCache<LeaderboardEntry[]>(key, entries);

    const stored = localStorage.getItem(key);
    const parsed = JSON.parse(stored!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].rank).toBe(1);
  });
});

describe("Draft API: getDraft / setDraft / clearDraft", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("getDraft(missionId) returns draft when exists", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const missionId = "m123";
    const draftKey = keys.draft(missionId);
    const draftData = { content: "My response" };
    localStorage.setItem(draftKey, JSON.stringify(draftData));

    const result = storage.getDraft(missionId);
    expect(result).toEqual(draftData);
    expect(result?.content).toBe("My response");
  });

  it("getDraft(missionId) returns null when draft does not exist", async () => {
    const storage = await import("@/lib/storage");

    const result = storage.getDraft("nonexistent");
    expect(result).toBeNull();
  });

  it("setDraft(missionId, content) stores draft using keys.draft()", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const missionId = "m456";
    const content = "Draft response content";

    storage.setDraft(missionId, content);

    const draftKey = keys.draft(missionId);
    const stored = localStorage.getItem(draftKey);
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!)).toEqual({ content });
  });

  it("clearDraft(missionId) removes draft using keys.draft()", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const missionId = "m789";
    const draftKey = keys.draft(missionId);

    storage.setDraft(missionId, "Temporary content");
    expect(localStorage.getItem(draftKey)).toBeDefined();

    storage.clearDraft(missionId);
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it("setDraft() overwrites existing draft", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const missionId = "m111";

    storage.setDraft(missionId, "First version");
    let result = storage.getDraft(missionId);
    expect(result?.content).toBe("First version");

    storage.setDraft(missionId, "Updated version");
    result = storage.getDraft(missionId);
    expect(result?.content).toBe("Updated version");
  });
});

describe("AI Notice Ack Flag: getAiNoticeAck / setAiNoticeAck", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("getAiNoticeAck() returns false when teampulse:ai_notice_ack does not exist", async () => {
    const storage = await import("@/lib/storage");

    const result = storage.getAiNoticeAck();
    expect(result).toBe(false);
  });

  it("getAiNoticeAck() returns true when teampulse:ai_notice_ack is set to 'true'", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    localStorage.setItem(keys.aiNoticeAck, "true");

    const result = storage.getAiNoticeAck();
    expect(result).toBe(true);
  });

  it("setAiNoticeAck() stores 'true' in teampulse:ai_notice_ack key", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    storage.setAiNoticeAck();

    const stored = localStorage.getItem(keys.aiNoticeAck);
    expect(stored).toBe("true");
  });

  it("setAiNoticeAck() followed by getAiNoticeAck() returns true", async () => {
    const storage = await import("@/lib/storage");

    expect(storage.getAiNoticeAck()).toBe(false);

    storage.setAiNoticeAck();

    expect(storage.getAiNoticeAck()).toBe(true);
  });

  it("getAiNoticeAck() returns false for invalid stored values", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    localStorage.setItem(keys.aiNoticeAck, "invalid-value");

    const result = storage.getAiNoticeAck();
    expect(result).toBe(false);
  });
});

describe("Edge Cases & Robustness", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("handles empty string keys gracefully", async () => {
    const storage = await import("@/lib/storage");

    const result = storage.readCache("");
    expect(result).toBeNull();
  });

  it("handles very large objects without crashing", async () => {
    const storage = await import("@/lib/storage");

    const largeArray = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      text: "x".repeat(100),
    }));

    // writeCache should handle large data
    expect(() => {
      storage.writeCache("large:data", largeArray);
    }).not.toThrow();

    const result = storage.readCache("large:data");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1000);
  });

  it("handles special characters in mission ID for draft keys", async () => {
    const storage = await import("@/lib/storage");
    const { keys } = await import("@/lib/types");

    const specialMissionId = "m:with/special&chars";
    const content = "Draft for special mission";

    storage.setDraft(specialMissionId, content);

    const draftKey = keys.draft(specialMissionId);
    const stored = localStorage.getItem(draftKey);
    expect(stored).toBeDefined();

    const retrieved = storage.getDraft(specialMissionId);
    expect(retrieved?.content).toBe(content);
  });

  it("clearProfile does not affect other cache keys", async () => {
    const storage = await import("@/lib/storage");
    const { keys, cacheKeys } = await import("@/lib/types");

    const testProfile: UserProfile = {
      userId: "u123",
      teamId: "t456",
      teamName: "Test",
      nickname: "Test",
      joinedAt: 123456,
    };

    // Set profile and draft
    storage.setProfile(testProfile);
    storage.setDraft("m1", "Content");

    // Clear profile
    storage.clearProfile();

    // Profile should be gone
    expect(storage.getProfile()).toBeNull();

    // Draft should still exist
    expect(storage.getDraft("m1")).toEqual({ content: "Content" });
  });

  it("clearDraft does not affect profile", async () => {
    const storage = await import("@/lib/storage");

    const testProfile: UserProfile = {
      userId: "u123",
      teamId: "t456",
      teamName: "Test",
      nickname: "Test",
      joinedAt: 123456,
    };

    // Set profile and draft
    storage.setProfile(testProfile);
    storage.setDraft("m1", "Content");

    // Clear draft
    storage.clearDraft("m1");

    // Profile should still exist
    expect(storage.getProfile()).toEqual(testProfile);

    // Draft should be gone
    expect(storage.getDraft("m1")).toBeNull();
  });

  it("multiple draft operations on different missions work independently", async () => {
    const storage = await import("@/lib/storage");

    storage.setDraft("m1", "Response 1");
    storage.setDraft("m2", "Response 2");
    storage.setDraft("m3", "Response 3");

    expect(storage.getDraft("m1")?.content).toBe("Response 1");
    expect(storage.getDraft("m2")?.content).toBe("Response 2");
    expect(storage.getDraft("m3")?.content).toBe("Response 3");

    storage.clearDraft("m2");

    expect(storage.getDraft("m1")?.content).toBe("Response 1");
    expect(storage.getDraft("m2")).toBeNull();
    expect(storage.getDraft("m3")?.content).toBe("Response 3");
  });
});
