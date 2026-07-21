/**
 * PACKET 0004: fetch 래퍼 + 타임아웃 + 표준 에러 + 캐시 폴백
 *
 * Skeleton file — implementation will be added during Green phase.
 *
 * Expected exports:
 * - apiFetch(path: string, opts?: FetchOptions): Promise<T>
 * - withCacheFallback<T>(fetcher: () => Promise<T>, cacheKey: string): Promise<T | {data: T; stale: true}>
 */

// Placeholder to satisfy TypeScript
export async function apiFetch(_path: string, _opts?: any): Promise<any> {
  throw new Error("apiFetch not implemented");
}

export async function withCacheFallback<T>(
  _fetcher: () => Promise<T>,
  _cacheKey: string,
): Promise<T | { data: T; stale: true }> {
  throw new Error("withCacheFallback not implemented");
}
