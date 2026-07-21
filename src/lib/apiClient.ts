import { getProfile, readCache, writeCache } from "@/lib/storage";

const TIMEOUT_MS = 8000;

export type FetchOptions = RequestInit;

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

  const headers = new Headers(opts.headers);
  if (opts.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!path.startsWith("/join")) {
    const profile = getProfile();
    if (profile?.userId) {
      headers.set("X-User-Id", profile.userId);
    }
  }

  const controller = new AbortController();
  const fetchPromise = fetch(`${base}${path}`, { ...opts, headers, signal: controller.signal });
  fetchPromise.catch(() => {});

  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("요청 시간이 초과되었습니다"));
    }, TIMEOUT_MS);
  });

  let response: Response;
  try {
    response = await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }

  if (response.status === 204) {
    return null as T;
  }

  const body = await response.json();

  if (body && typeof body === "object" && "error" in body) {
    throw new Error(String((body as { error: unknown }).error));
  }

  if (!response.ok) {
    throw new Error("네트워크 연결을 확인해주세요");
  }

  writeCache(path, body);
  return body as T;
}

export async function withCacheFallback<T>(
  fetcher: () => Promise<T>,
  cacheKey: string,
): Promise<T | { data: T; stale: true }> {
  try {
    const data = await fetcher();
    writeCache(cacheKey, data);
    return data;
  } catch {
    const cached = readCache<T>(cacheKey);
    if (cached !== null) {
      return { data: cached, stale: true };
    }
    throw new Error("네트워크 연결을 확인해주세요");
  }
}
