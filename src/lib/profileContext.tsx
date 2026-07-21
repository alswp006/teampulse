import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { UserProfile } from "@/lib/types";
import { getProfile, setProfile as persistProfile, getAiNoticeAck, setAiNoticeAck } from "@/lib/storage";

export interface ProfileContextValue {
  profile: UserProfile | null;
  setProfileAndPersist: (profile: UserProfile) => void;
  aiNoticeAck: boolean;
  ackAiNotice: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(() => getProfile());
  const [aiNoticeAck, setAiNoticeAckState] = useState(() => getAiNoticeAck());

  const setProfileAndPersist = useCallback((next: UserProfile) => {
    persistProfile(next);
    setProfile(next);
  }, []);

  const ackAiNotice = useCallback(() => {
    setAiNoticeAck();
    setAiNoticeAckState(true);
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, setProfileAndPersist, aiNoticeAck, ackAiNotice }),
    [profile, setProfileAndPersist, aiNoticeAck, ackAiNotice],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}
