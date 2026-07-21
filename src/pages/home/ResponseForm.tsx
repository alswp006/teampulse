import { useState, type ChangeEvent } from 'react';
import { Button, Chip, Paragraph, Spacing, TextArea, Toast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { clearDraft, getDraft, setDraft } from '@/lib/storage';
import { createResponse } from '@/lib/api/endpoints';
import type { Mission } from '@/lib/types';

const MAX_LENGTH = 300;

function fireHaptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'success' })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export function ResponseForm({
  mission,
  onSubmitted,
}: {
  mission: Mission;
  onSubmitted: () => void;
}) {
  const [content, setContent] = useState(() => getDraft(mission.missionId)?.content ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value.slice(0, MAX_LENGTH);
    setContent(next);
    setDraft(mission.missionId, next);
  };

  const handleSubmit = async () => {
    if (submitting || content.trim() === '') return;
    setSubmitting(true);
    try {
      await createResponse(mission.missionId, content, mission.anonymous);
      fireHaptic();
      setToastText('응답을 남겼어요');
      clearDraft(mission.missionId);
      onSubmitted();
      (document.activeElement as HTMLElement | null)?.blur();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {mission.anonymous && (
        <>
          <Chip>익명으로 등록돼요</Chip>
          <Spacing size={8} />
        </>
      )}
      <div data-testid="response-textarea-wrapper" style={{ minWidth: 44, minHeight: 44 }}>
        <TextArea
          variant="box"
          label="응답"
          placeholder="자유롭게 남겨주세요"
          value={content}
          onChange={handleChange}
          maxLength={MAX_LENGTH}
        />
      </div>
      <Spacing size={4} />
      <Paragraph.Text typography="st13" color="tertiary">
        {content.length}/{MAX_LENGTH}
      </Paragraph.Text>
      <Spacing size={12} />
      <Button
        variant="fill"
        size="large"
        display="block"
        disabled={content.trim() === '' || submitting}
        onClick={handleSubmit}
      >
        응답 남기기
      </Button>
      <Toast open={!!toastText} text={toastText ?? ''} position="bottom" />
    </div>
  );
}
