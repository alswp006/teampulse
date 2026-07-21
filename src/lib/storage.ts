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

// ─── Profile API ─────────────────────────────────────────────────────────────

export function getProfile(): UserProfile | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

export function setProfile(profile: UserProfile): void {
  // TODO: Implement (catch QuotaExceededError silently)
  throw new Error("Not implemented");
}

export function clearProfile(): void {
  // TODO: Implement
  throw new Error("Not implemented");
}

// ─── Generic Cache API ───────────────────────────────────────────────────────

export function readCache<T>(key: string): T | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

export function writeCache<T>(key: string, value: T): void {
  // TODO: Implement (catch QuotaExceededError silently)
  throw new Error("Not implemented");
}

// ─── Draft API ───────────────────────────────────────────────────────────────

export function getDraft(missionId: string): { content: string } | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

export function setDraft(missionId: string, content: string): void {
  // TODO: Implement (catch QuotaExceededError silently)
  throw new Error("Not implemented");
}

export function clearDraft(missionId: string): void {
  // TODO: Implement
  throw new Error("Not implemented");
}

// ─── AI Notice Ack Flag ──────────────────────────────────────────────────────

export function getAiNoticeAck(): boolean {
  // TODO: Implement
  throw new Error("Not implemented");
}

export function setAiNoticeAck(): void {
  // TODO: Implement
  throw new Error("Not implemented");
}
