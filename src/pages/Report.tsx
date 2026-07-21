import { useEffect, useState } from 'react';
import { Top, Chip, Spacing, Paragraph, Toast, AlertDialog } from '@toss/tds-mobile';
import { showFullScreenAd } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { CountUp } from '@/components/CountUp';
import { Sparkline } from '@/components/Sparkline';
import { EmptyState, LoadingState } from '@/components/StateView';
import { fetchWeeklyReport } from '@/lib/api/endpoints';
import { useProfile } from '@/lib/profileContext';
import type { WeeklyReport } from '@/lib/types';

const AD_SLOT_ID = import.meta.env.VITE_TOSS_AD_SLOT_ID ?? 'weekly-report';

function unwrapReport(
  result: WeeklyReport | null | { data: WeeklyReport | null; stale: true },
): WeeklyReport | null {
  if (result && typeof result === 'object' && 'stale' in result) {
    return result.data;
  }
  return result;
}

export default function Report() {
  const { profile, aiNoticeAck, ackAiNotice } = useProfile();
  const teamId = profile?.teamId;

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [dismissedMessage, setDismissedMessage] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.resolve()
      .then(() => fetchWeeklyReport(teamId))
      .then((result) => {
        if (!cancelled) setReport(unwrapReport(result));
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const handleWatchAd = () => {
    try {
      showFullScreenAd({
        slotId: AD_SLOT_ID,
        onEvent: (event: { type?: string }) => {
          if (event?.type === 'rewarded' || event?.type === 'completed') {
            setUnlocked(true);
          } else {
            setDismissedMessage(true);
          }
        },
        onError: () => {
          // 광고 재생 실패(런타임 문제 등) — 리포트를 영구히 막지 않는다
          setUnlocked(true);
        },
      } as Parameters<typeof showFullScreenAd>[0]);
    } catch {
      // 앱인토스 WebView 밖(로컬 브라우저 등) — SDK 호출이 throw → 언락으로 폴백
      setUnlocked(true);
    }
  };

  const keywords = report?.positiveKeywords.slice(0, 8) ?? [];

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>주간 리포트</Top.TitleParagraph>} />}>
      {loading ? (
        <LoadingState rows={4} />
      ) : !report ? (
        <EmptyState
          title="이번 주 리포트가 아직 준비되지 않았어요"
          description="팀 활동이 쌓이면 다음 주에 만나요"
        />
      ) : !unlocked ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            padding: '32px 16px',
          }}
        >
          <Paragraph.Text typography="t5">광고를 보면 이번 주 리포트를 볼 수 있어요</Paragraph.Text>
          <Paragraph.Text typography="st13" color="tertiary" data-testid="ai-badge">
            AI가 생성한 리포트예요
          </Paragraph.Text>
          <button
            type="button"
            data-testid="report-view-button"
            onClick={handleWatchAd}
            style={{
              minHeight: 48,
              minWidth: 200,
              width: '100%',
              maxWidth: 320,
              borderRadius: 12,
              border: 'none',
              backgroundColor: 'var(--tds-color-blue500)',
              color: 'var(--tds-color-white)',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            이번 주 리포트 보기
          </button>
          <Toast open={dismissedMessage} text="광고를 끝까지 보면 리포트를 볼 수 있어요" position="bottom" />
        </div>
      ) : (
        <Card testId="report-card">
          <Paragraph.Text typography="st11">참여율</Paragraph.Text>
          <Spacing size={4} />
          <CountUp value={report.participationRate} unit="%" typography="t1" />
          <Spacing size={8} />
          <Paragraph.Text typography="st11">분위기 점수</Paragraph.Text>
          <Spacing size={4} />
          <CountUp value={report.moodScore} unit="점" typography="t2" />
          <Spacing size={16} />
          <Sparkline data={report.moodTrend} testId="mood-sparkline" />
          {keywords.length > 0 && (
            <>
              <Spacing size={16} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {keywords.map((keyword) => (
                  <Chip key={keyword}>{keyword}</Chip>
                ))}
              </div>
            </>
          )}
          <Spacing size={16} />
          <Paragraph.Text typography="t6">{report.summary}</Paragraph.Text>
          <Spacing size={8} />
          <div data-testid="ai-badge">
            <Paragraph.Text typography="st13">AI가 생성한 결과입니다</Paragraph.Text>
          </div>
        </Card>
      )}
      <AlertDialog
        open={!aiNoticeAck}
        title="생성형 AI 사용 안내"
        description="이번 주 리포트는 생성형 AI가 만들어요"
        onClose={ackAiNotice}
      />
    </ScreenScaffold>
  );
}
