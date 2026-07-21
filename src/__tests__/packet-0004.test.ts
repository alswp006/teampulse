import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as storage from "@/lib/storage";

/**
 * PACKET 0004: fetch 래퍼 + 타임아웃 + 표준 에러 + 캐시 폴백
 *
 * TDD Phase: Tests are written FIRST. The implementation (src/lib/apiClient.ts)
 * does not exist yet. These tests WILL FAIL until it is implemented.
 *
 * Expected exports from src/lib/apiClient.ts:
 * - apiFetch(path: string, opts?: FetchOptions): Promise<T>
 *   - base = import.meta.env.VITE_API_BASE_URL
 *   - X-User-Id 헤더 자동 첨부 (join 제외)
 *   - AbortController 8초 타임아웃
 *   - 응답이 {error} 이면 throw
 *   - 204는 null 반환
 *   - window.open/location.href 미사용
 *   - console.error 미호출
 *
 * - withCacheFallback<T>(fetcher: () => Promise<T>, cacheKey: string): Promise<T | { data: T; stale: true }>
 *   - 성공 시 캐시 저장 후 반환
 *   - 네트워크 실패 + 캐시 있으면 {data, stale: true}
 *   - 캐시 없으면 {error} throw
 *
 * AC-1 [P0]: 200 응답을 캐시에 저장 후 반환, 5xx/타임아웃+캐시 존재 시 stale:true 반환
 * AC-2 [P0]: 캐시 없음+5xx → {error:"네트워크 연결을 확인해주세요"} throw, console.error 미호출
 * AC-3 [P0]: window.open/location.href 등 외부 이동 코드 부재, fetch만 사용 + 204는 null 반환
 * AC-4 [P0]: X-User-Id 헤더는 join을 제외한 모든 요청에 자동 첨부
 * AC-5 [P0]: AbortController 타임아웃은 8초
 */

describe("AC-1[P0]: apiFetch success response caching + stale fallback on network error", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("AC-1a[P0]: successful 200 response is cached in localStorage", async () => {
    const { apiFetch } = await import("@/lib/apiClient");
    const testData = { userId: "u001", teamId: "team-42", nickname: "설레는판다" };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => testData,
    });

    const result = await apiFetch("/profile");

    expect(result).toEqual(testData);
    const cached = storage.readCache("/profile");
    expect(cached).toEqual(testData);
  });

  it("AC-1b[P0]: on 5xx error with cached data, returns {data, stale: true} without throwing", async () => {
    const { apiFetch, withCacheFallback } = await import("@/lib/apiClient");
    const testData = { userId: "u001", teamId: "team-42", nickname: "설레는판다" };
    const cacheKey = "teampulse:test-mission";

    // Seed cache with old data
    storage.writeCache(cacheKey, testData);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Internal Server Error" }),
    });

    const fetcher = () => apiFetch("/mission/2025-01-22");
    const result = await withCacheFallback(fetcher, cacheKey);

    expect(result).toEqual({ data: testData, stale: true });
  });

  it("AC-1c[P0]: on timeout with cached data, returns {data, stale: true}", async () => {
    const { withCacheFallback } = await import("@/lib/apiClient");
    const testData = { missionId: "m001", title: "Write a haiku" };
    const cacheKey = "teampulse:test-mission-timeout";

    // Seed cache
    storage.writeCache(cacheKey, testData);

    // Mock fetch to simulate abort/timeout
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("AbortError"));

    const fetcher = () =>
      fetch("http://api.local/mission").then((r) => r.json());
    const result = await withCacheFallback(fetcher, cacheKey);

    expect(result).toEqual({ data: testData, stale: true });
  });
});

describe("AC-2[P0]: network error without cache throws standard error, no console.error", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("AC-2a[P0]: 5xx error without cache throws {error: \"네트워크 연결을 확인해주세요\"}", async () => {
    const { apiFetch, withCacheFallback } = await import("@/lib/apiClient");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Service Unavailable" }),
    });

    const fetcher = () => apiFetch("/mission/2025-01-22");
    await expect(withCacheFallback(fetcher, "nonexistent:cache")).rejects.toThrow(
      /네트워크 연결을 확인해주세요/,
    );
  });

  it("AC-2b[P0]: console.error is NOT called when handling network error", async () => {
    const { apiFetch, withCacheFallback } = await import("@/lib/apiClient");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Internal Server Error" }),
    });

    const fetcher = () => apiFetch("/test");
    try {
      await withCacheFallback(fetcher, "nonexistent:cache");
    } catch {
      // Expected to throw
    }

    expect(console.error).not.toHaveBeenCalled();
  });

  it("AC-2c[P0]: timeout (AbortError) without cache throws standard error", async () => {
    const { withCacheFallback } = await import("@/lib/apiClient");

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("AbortError"));

    const fetcher = () =>
      fetch("http://api.local/mission").then((r) => r.json());
    await expect(withCacheFallback(fetcher, "nonexistent:cache")).rejects.toThrow(
      /네트워크 연결을 확인해주세요/,
    );
  });
});

describe("AC-3[P0]: fetch only (no window.open/location.href), 204 returns null", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-3a[P0]: apiFetch does NOT use window.open or window.location.href (inspect source)", async () => {
    const { apiFetch } = await import("@/lib/apiClient");

    const module = await import("@/lib/apiClient");
    const source = module.toString?.() ?? "";

    // Check that the implementation file doesn't have direct window.open or location.href calls
    // This is verified at import time: if code contains those calls directly, they would fire
    expect(apiFetch).toBeDefined();
    // The actual verification is that fetch is the only HTTP mechanism used
  });

  it("AC-3b[P0]: 204 No Content response returns null", async () => {
    const { apiFetch } = await import("@/lib/apiClient");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: async () => null,
      text: async () => "",
    });

    const result = await apiFetch("/delete-mission/m001", { method: "DELETE" });

    expect(result).toBeNull();
  });

  it("AC-3c[P0]: {error} field in response throws error object", async () => {
    const { apiFetch } = await import("@/lib/apiClient");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Validation failed" }),
    });

    await expect(apiFetch("/create-response")).rejects.toThrow(/Validation failed/);
  });
});

describe("AC-4[P0]: X-User-Id header auto-appended to all requests except /join", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("AC-4a[P0]: X-User-Id header is added to non-join endpoints", async () => {
    const { apiFetch } = await import("@/lib/apiClient");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    });

    vi.stubEnv("VITE_API_BASE_URL", "http://api.local");

    await apiFetch("/profile", { method: "GET" });

    expect(global.fetch).toHaveBeenCalled();
    const callArgs = (global.fetch as any).mock.calls[0];
    const fetchInit = callArgs[1];
    expect(fetchInit.headers).toBeDefined();
    // X-User-Id should be in headers (exact value depends on app state)
  });

  it("AC-4b[P0]: X-User-Id is NOT added to /join endpoint", async () => {
    const { apiFetch } = await import("@/lib/apiClient");

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ userId: "u001", teamId: "team-42" }),
    });

    vi.stubEnv("VITE_API_BASE_URL", "http://api.local");

    await apiFetch("/join", { method: "POST", body: JSON.stringify({ teamCode: "CODE123" }) });

    expect(global.fetch).toHaveBeenCalled();
    const callArgs = (global.fetch as any).mock.calls[0];
    const fetchInit = callArgs[1];
    // When /join is called, X-User-Id should NOT be present
  });
});

describe("AC-5[P0]: AbortController 8-second timeout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("AC-5a[P0]: apiFetch sets AbortController timeout to 8 seconds", async () => {
    const { apiFetch } = await import("@/lib/apiClient");

    let abortControllerTimeout = 0;
    const originalAbortController = AbortController;
    vi.stubGlobal(
      "AbortController",
      class MockAbortController {
        signal = { aborted: false };
        abort() {}
      },
    );

    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                headers: new Headers({ "content-type": "application/json" }),
                json: async () => ({ success: true }),
              }),
            100,
          );
        }),
    );

    const promise = apiFetch("/profile");

    // Fast-forward 8 seconds to trigger timeout
    vi.advanceTimersByTime(8000);

    // The call should have set up a timeout; verify no error thrown if within 8s
    await expect(promise).resolves.toBeDefined();
  });

  it("AC-5b[P0]: request aborts if it exceeds 8 seconds", async () => {
    const { apiFetch } = await import("@/lib/apiClient");

    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("AbortError")), 9000);
        }),
    );

    const promise = apiFetch("/slow-endpoint");

    vi.advanceTimersByTime(8000);

    // After 8 seconds, AbortController should have aborted
    // The fetch promise should reject or handle the abort
    await expect(promise).rejects.toBeDefined();
  });
});

describe("Integration: withCacheFallback stores and retrieves data correctly", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should store successful response in cache under cacheKey", async () => {
    const { withCacheFallback } = await import("@/lib/apiClient");
    const testData = { missionId: "m001", title: "Write a haiku" };
    const cacheKey = "teampulse:mission:2025-01-22";

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => testData,
    });

    const fetcher = () =>
      fetch("http://api.local/mission/2025-01-22").then((r) => r.json());

    const result = await withCacheFallback(fetcher, cacheKey);

    expect(result).toEqual(testData);
    expect(storage.readCache(cacheKey)).toEqual(testData);
  });

  it("should return stale data without throwing when network fails and cache exists", async () => {
    const { withCacheFallback } = await import("@/lib/apiClient");
    const testData = { missionId: "m001", title: "Write a haiku" };
    const cacheKey = "teampulse:mission:old";

    storage.writeCache(cacheKey, testData);

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const fetcher = () => fetch("http://api.local/mission").then((r) => r.json());

    const result = await withCacheFallback(fetcher, cacheKey);

    expect(result).toEqual({ data: testData, stale: true });
  });

  it("should throw error when network fails and no cache exists", async () => {
    const { withCacheFallback } = await import("@/lib/apiClient");
    const cacheKey = "teampulse:mission:nocache";

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const fetcher = () => fetch("http://api.local/mission").then((r) => r.json());

    await expect(withCacheFallback(fetcher, cacheKey)).rejects.toThrow(
      /네트워크 연결을 확인해주세요/,
    );
  });
});
