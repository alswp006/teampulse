import { useEffect, useState } from 'react';
import { Top, ListRow, Chip, Spacing, Paragraph } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { Amount } from '@/components/Amount';
import { EmptyState, LoadingState } from '@/components/StateView';
import { fetchLeaderboard } from '@/lib/api/endpoints';
import { useProfile } from '@/lib/profileContext';
import type { BadgeId, LeaderboardEntry, LeaderboardResponse } from '@/lib/types';

const BADGE_LABELS: Record<BadgeId, string> = {
  streak7: '7일 연속',
  first_responder: '1등 참여',
  top_praise: '칭찬왕',
  perfect_week: '풀 참여',
};

function unwrapLeaderboard(
  result: LeaderboardResponse | { data: LeaderboardResponse; stale: true },
): LeaderboardResponse {
  if (result && typeof result === 'object' && 'stale' in result) {
    return result.data;
  }
  return result;
}

export default function Leaderboard() {
  const { profile } = useProfile();
  const teamId = profile?.teamId;

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState(0);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.resolve()
      .then(() => fetchLeaderboard(teamId))
      .then((result) => {
        if (cancelled) return;
        const unwrapped = unwrapLeaderboard(result);
        setEntries(unwrapped.entries);
        setMyRank(unwrapped.myRank);
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          setMyRank(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const myEntry = entries.find((e) => e.userId === profile?.userId);

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>리더보드</Top.TitleParagraph>} />}>
      {!loading && (
        <SummaryHero
          label="내 연속 참여"
          value={<Amount value={myEntry?.streak ?? 0} unit="일" typography="t1" />}
          caption={`팀 내 ${myRank}위`}
          testId="my-rank-hero"
        />
      )}
      <Spacing size={24} />
      <Paragraph.Text typography="t4">팀 랭킹</Paragraph.Text>
      <Spacing size={12} />
      {loading ? (
        <LoadingState rows={3} />
      ) : entries.length === 0 ? (
        <EmptyState title="아직 랭킹이 없어요" description="미션에 참여하면 순위가 보여요" />
      ) : (
        entries.map((entry) => (
          <div key={entry.userId} data-testid={`rank-row-${entry.userId}`}>
            <ListRow
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={`${entry.rank}. ${entry.nickname}`}
                  bottom={`참여 ${entry.participationCount}회 · streak ${entry.streak}`}
                />
              }
              right={
                entry.badges.length > 0 ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {entry.badges.map((badgeId) => (
                      <div
                        key={badgeId}
                        data-testid={`badge-${entry.userId}-${badgeId}`}
                        style={{
                          minWidth: 44,
                          minHeight: 44,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Chip>{BADGE_LABELS[badgeId]}</Chip>
                      </div>
                    ))}
                  </div>
                ) : undefined
              }
            />
            <Spacing size={8} />
          </div>
        ))
      )}
    </ScreenScaffold>
  );
}
