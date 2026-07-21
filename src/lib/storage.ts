import type { UserProfile } from "@/lib/types";
import { keys, cacheKeys } from "@/lib/types";

export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

function setItemSafe<T>(key: string, value: T): void {
  try {
    setItem(key, value);
  } catch {
    // quota exceeded or storage unavailable — skip write, app continues
  }
}

// ─── Profile API ─────────────────────────────────────────────────────────────

export function getProfile(): UserProfile | null {
  return getItem<UserProfile>(keys.profile);
}

export function setProfile(profile: UserProfile): void {
  setItemSafe(keys.profile, profile);
}

export function clearProfile(): void {
  removeItem(keys.profile);
}

// ─── Generic Cache API ───────────────────────────────────────────────────────

export function readCache<T>(key: string): T | null {
  return getItem<T>(key);
}

export function writeCache<T>(key: string, value: T): void {
  setItemSafe(key, value);
}

// ─── Draft API ───────────────────────────────────────────────────────────────

export function getDraft(missionId: string): { content: string } | null {
  return getItem<{ content: string }>(keys.draft(missionId));
}

export function setDraft(missionId: string, content: string): void {
  setItemSafe(keys.draft(missionId), { content });
}

export function clearDraft(missionId: string): void {
  removeItem(keys.draft(missionId));
}

// ─── AI Notice Ack Flag ──────────────────────────────────────────────────────

export function getAiNoticeAck(): boolean {
  return localStorage.getItem(keys.aiNoticeAck) === "true";
}

export function setAiNoticeAck(): void {
  try {
    localStorage.setItem(keys.aiNoticeAck, "true");
  } catch {
    // quota exceeded — skip write, app continues
  }
}
