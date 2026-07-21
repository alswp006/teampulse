import { createContext, useContext, useState, type ReactNode } from "react";
import type { UserProfile } from "@/lib/types";

/**
 * STUB — pending Coder implementation for packet 0003.
 *
 * This skeleton exists only to keep `npx tsc --noEmit` green (module + types
 * resolve) for src/__tests__/packet-0003.test.ts. It intentionally does NOT
 * wire up src/lib/storage.ts yet — that is the Coder's job:
 * - ProfileProvider must load profile/aiNoticeAck from storage.getProfile()/
 *   getAiNoticeAck() on mount.
 * - setProfileAndPersist() must call storage.setProfile() in addition to
 *   updating context state.
 * - ackAiNotice() must call storage.setAiNoticeAck() in addition to updating
 *   context state.
 * Until that's done, src/__tests__/packet-0003.test.ts stays red (AC-1b,
 * AC-1c, AC-2b, AC-2c fail against this stub).
 */

export interface ProfileContextValue {
  profile: UserProfile | null;
  setProfileAndPersist: (profile: UserProfile) => void;
  aiNoticeAck: boolean;
  ackAiNotice: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [aiNoticeAck, setAiNoticeAckState] = useState(false);

  const value: ProfileContextValue = {
    profile,
    setProfileAndPersist: setProfile,
    aiNoticeAck,
    ackAiNotice: () => setAiNoticeAckState(true),
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}
