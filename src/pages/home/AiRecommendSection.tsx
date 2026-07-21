import { useState } from 'react';
import { AlertDialog, Button, Paragraph, Spacing, Toast } from '@toss/tds-mobile';
import { Card } from '@/components/Card';
import { recommendMission } from '@/lib/api/endpoints';
import { useProfile } from '@/lib/profileContext';
import type { Mission } from '@/lib/types';

const INSUFFICIENT_DATA_MESSAGE = '분석할 데이터가 부족해요';
const FALLBACK_TOAST_MESSAGE = '지금은 추천을 못 받았어요. 기본 미션을 사용할게요';
const FALLBACK_MISSION_TITLE = '오늘 있었던 일 나누기';
const FALLBACK_MISSION_PROMPT = '오늘 소소하게 있었던 일을 편하게 나눠주세요';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; mission: Mission; rationale: string }
  | { kind: 'insufficient' }
  | { kind: 'fallback' };

export function AiRecommendSection() {
  const { profile, aiNoticeAck, ackAiNotice } = useProfile();
  const teamId = profile?.teamId;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const runRecommend = async () => {
    if (!teamId) return;
    setStatus({ kind: 'loading' });
    try {
      const result = await recommendMission(teamId);
      setStatus({ kind: 'success', mission: result.mission, rationale: result.rationale });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setStatus({ kind: message === INSUFFICIENT_DATA_MESSAGE ? 'insufficient' : 'fallback' });
    }
  };

  const handleTrigger = () => {
    if (status.kind === 'loading') return;
    if (!aiNoticeAck) {
      setDialogOpen(true);
      return;
    }
    void runRecommend();
  };

  const handleConfirmNotice = () => {
    setDialogOpen(false);
    ackAiNotice();
    void runRecommend();
  };

  return (
    <div>
      <Button
        variant="weak"
        size="medium"
        display="block"
        disabled={status.kind === 'loading'}
        onClick={handleTrigger}
      >
        {status.kind === 'loading' ? '팀 분위기를 분석하고 있어요' : 'AI 추천 미션 받기'}
      </Button>
      <AlertDialog
        open={dialogOpen}
        title="이 서비스는 생성형 AI를 활용합니다"
        description="AI가 팀 분위기를 분석해 미션을 추천해요"
        alertButton={<AlertDialog.AlertButton onClick={handleConfirmNotice}>확인</AlertDialog.AlertButton>}
        onClose={() => setDialogOpen(false)}
      />
      {status.kind === 'success' && (
        <>
          <Spacing size={12} />
          <Card testId="ai-recommend-card">
            <Paragraph.Text typography="t4">{status.mission.title}</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="st13">{status.rationale}</Paragraph.Text>
            <Spacing size={8} />
            <Paragraph.Text typography="st13" data-testid="ai-badge">
              AI가 생성한 결과입니다
            </Paragraph.Text>
          </Card>
        </>
      )}
      {status.kind === 'insufficient' && (
        <>
          <Spacing size={12} />
          <Paragraph.Text typography="st13">{INSUFFICIENT_DATA_MESSAGE}</Paragraph.Text>
          <Spacing size={8} />
          <Card testId="fallback-mission">
            <Paragraph.Text typography="t4">{FALLBACK_MISSION_TITLE}</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="st13">{FALLBACK_MISSION_PROMPT}</Paragraph.Text>
          </Card>
        </>
      )}
      {status.kind === 'fallback' && (
        <>
          <Spacing size={12} />
          <Card testId="fallback-mission">
            <Paragraph.Text typography="t4">{FALLBACK_MISSION_TITLE}</Paragraph.Text>
            <Spacing size={4} />
            <Paragraph.Text typography="st13">{FALLBACK_MISSION_PROMPT}</Paragraph.Text>
          </Card>
          <Toast open text={FALLBACK_TOAST_MESSAGE} position="bottom" />
        </>
      )}
    </div>
  );
}
