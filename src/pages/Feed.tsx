import { useEffect, useMemo, useState } from 'react';
import { Top, ListRow, Chip, Spacing, Paragraph, Button, Toast } from '@toss/tds-mobile';
import { useLocation } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { EmptyState, LoadingState } from '@/components/StateView';
import { fetchFeed, reactToResponse } from '@/lib/api/endpoints';
import { useProfile } from '@/lib/profileContext';
import type { MissionResponse, RouteState } from '@/lib/types';

type Filter = 'today' | 'yesterday';

function unwrapFeed(
  result: MissionResponse[] | { data: MissionResponse[]; stale: true },
): MissionResponse[] {
  if (result && typeof result === 'object' && 'stale' in result) {
    return result.data;
  }
  return result;
}

function fireHaptic(type: 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export default function Feed() {
  const location = useLocation();
  const { profile } = useProfile();
  const initialMissionId = (location.state as RouteState['/feed'] | null)?.missionId;

  const [filter, setFilter] = useState<Filter>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [responses, setResponses] = useState<MissionResponse[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const teamId = profile?.teamId;
  const missionId = filter === 'today' ? initialMissionId : undefined;

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.resolve()
      .then(() => fetchFeed(teamId, missionId))
      .then((result) => {
        if (!cancelled) setResponses(unwrapFeed(result));
      })
      .catch(() => {
        if (!cancelled) {
          setResponses([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, missionId, reloadTick]);

  const sorted = useMemo(
    () => [...responses].sort((a, b) => b.createdAt - a.createdAt),
    [responses],
  );

  function handleFilterChange(next: Filter) {
    if (next === filter) return;
    fireHaptic('tickWeak');
    setFilter(next);
  }

  function handleReact(responseId: string, currentReactions: number) {
    fireHaptic('tickWeak');
    setResponses((prev) =>
      prev.map((r) =>
        r.responseId === responseId ? { ...r, reactions: r.reactions + 1 } : r,
      ),
    );
    reactToResponse(responseId)
      .then((result) => {
        setResponses((prev) =>
          prev.map((r) =>
            r.responseId === responseId ? { ...r, reactions: result.reactions } : r,
          ),
        );
      })
      .catch(() => {
        setResponses((prev) =>
          prev.map((r) =>
            r.responseId === responseId ? { ...r, reactions: currentReactions } : r,
          ),
        );
        setToast('잠시 후 다시 시도해주세요');
      });
  }

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>팀 피드</Top.TitleParagraph>} />}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        <Chip variant={filter === 'today' ? 'fill' : 'weak'} onClick={() => handleFilterChange('today')}>
          오늘
        </Chip>
        <Chip
          variant={filter === 'yesterday' ? 'fill' : 'weak'}
          onClick={() => handleFilterChange('yesterday')}
        >
          어제
        </Chip>
      </div>
      <Spacing size={16} />
      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <>
          <Paragraph.Text typography="t6">인터넷 연결을 확인해주세요</Paragraph.Text>
          <Spacing size={12} />
          <Button variant="weak" onClick={() => setReloadTick((n) => n + 1)}>
            다시 시도
          </Button>
        </>
      ) : sorted.length === 0 ? (
        <EmptyState title="아직 응답이 없어요" description="가장 먼저 참여해 보세요" />
      ) : (
        sorted.map((r) => (
          <div key={r.responseId} data-testid={`feed-item-${r.responseId}`}>
            <ListRow
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={r.anonymous ? '익명' : r.nickname}
                  bottom={r.content}
                />
              }
              right={
                <div
                  data-testid={`reaction-${r.responseId}`}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Chip onClick={() => handleReact(r.responseId, r.reactions)}>
                    {`공감 ${r.reactions}`}
                  </Chip>
                </div>
              }
            />
            <Spacing size={8} />
          </div>
        ))
      )}
      <Toast open={toast !== null} text={toast ?? ''} position="bottom" onClose={() => setToast(null)} />
    </ScreenScaffold>
  );
}
