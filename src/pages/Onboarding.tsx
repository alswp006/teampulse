import { useState, type ChangeEvent, type FocusEvent } from 'react';
import { Top, Paragraph, Spacing, TextField, Toast } from '@toss/tds-mobile';
import { Navigate, useNavigate } from 'react-router-dom';
import { grantPromotionReward } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { joinTeam } from '@/lib/api/endpoints';
import { useProfile } from '@/lib/profileContext';

const JOIN_PROMOTION_CODE = 'ONBOARDING_JOIN';
const JOIN_PROMOTION_AMOUNT = 1000;

function scrollFieldIntoView(e: FocusEvent<HTMLInputElement>) {
  e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, setProfileAndPersist } = useProfile();

  const [teamCode, setTeamCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  // 프로필이 이미 있으면(재방문 등) 온보딩 폼을 렌더하지 않고 즉시 홈으로 보낸다.
  if (profile) {
    return <Navigate to="/" replace />;
  }

  const handleTeamCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTeamCode(e.target.value);
  };

  const handleNicknameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNickname(e.target.value);
    setNicknameError(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!nickname.trim()) {
      setNicknameError(true);
      return;
    }
    setNicknameError(false);
    setCodeError(null);
    setSubmitting(true);
    (document.activeElement as HTMLElement | null)?.blur();
    try {
      const res = await joinTeam(teamCode, nickname);
      setProfileAndPersist({
        userId: res.userId,
        teamId: res.teamId,
        teamName: res.teamName,
        nickname,
        joinedAt: Date.now(),
      });
      if (JOIN_PROMOTION_AMOUNT <= 5000) {
        try {
          // 설치된 @apps-in-toss/web-bridge .d.ts는 params 래핑을 요구하지만, 검증된
          // apps-in-toss-essential.txt 레퍼런스의 실제 호출 규약은 평탄한 인자다 — 그 쪽을 따른다.
          await (
            grantPromotionReward as unknown as (params: {
              promotionCode: string;
              amount: number;
            }) => Promise<unknown>
          )({
            promotionCode: JOIN_PROMOTION_CODE,
            amount: JOIN_PROMOTION_AMOUNT,
          });
        } catch {
          // 프로모션 지급 실패는 참여 성공을 막지 않는다
        }
      }
      setToastText(`${res.teamName}에 참여했어요`);
      navigate('/', { replace: true });
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : '팀 참여에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>팀에 참여하기</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="팀 참여하기" onClick={handleSubmit} disabled={submitting} />}
    >
      <Spacing size={16} />
      <Paragraph.Text typography="t3">팀 코드와 닉네임을 입력해요</Paragraph.Text>
      <Spacing size={24} />
      <TextField
        variant="box"
        label="팀 초대 코드"
        placeholder="팀 코드를 입력해주세요"
        value={teamCode}
        onChange={handleTeamCodeChange}
        onFocus={scrollFieldIntoView}
        enterKeyHint="next"
      />
      <Spacing size={16} />
      <TextField
        variant="box"
        label="닉네임"
        placeholder="닉네임을 입력해주세요"
        help={nicknameError ? '닉네임을 입력해주세요' : '1~12자'}
        hasError={nicknameError}
        value={nickname}
        onChange={handleNicknameChange}
        onFocus={scrollFieldIntoView}
      />
      <Spacing size={8} />
      {codeError && (
        <Paragraph.Text typography="st13" color="tertiary">
          {codeError}
        </Paragraph.Text>
      )}
      <Toast open={!!toastText} text={toastText ?? ''} position="bottom" />
    </ScreenScaffold>
  );
}
