import { useEffect, useState } from 'react';
import { Top, Paragraph, Spacing, Button } from '@toss/tds-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { EmptyState, LoadingState } from '@/components/StateView';
import { ResponseForm } from '@/pages/home/ResponseForm';
import { AiRecommendSection } from '@/pages/home/AiRecommendSection';
import { fetchTodayMission } from '@/lib/api/endpoints';
import { useProfile } from '@/lib/profileContext';
import type { Mission, MissionType, RouteState } from '@/lib/types';

const respondedKey = (missionId: string) => `teampulse:responded:${missionId}`;

const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  hobby: '취미 미션',
  praise: '칭찬 미션',
  worry: '고민 미션',
  custom: '오늘의 미션',
};

function unwrapMission(result: Mission | null | { data: Mission | null; stale: true }): Mission | null {
  if (result && typeof result === 'object' && 'stale' in result) {
    return result.data;
  }
  return result;
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  // AC-2: location.state를 RouteState로 캐스팅 — state 유무와 무관하게 크래시 없이 렌더한다.
  void ((location.state as RouteState['/']) ?? undefined);

  const [loading, setLoading] = useState(true);
  const [mission, setMission] = useState<Mission | null>(null);
  const [justResponded, setJustResponded] = useState(false);

  const teamId = profile?.teamId;

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.resolve()
      .then(() => fetchTodayMission(teamId))
      .then((result) => {
        if (!cancelled) setMission(unwrapMission(result));
      })
      .catch(() => {
        if (!cancelled) setMission(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const responded =
    justResponded || (mission ? localStorage.getItem(respondedKey(mission.missionId)) === 'true' : false);

  const handleSubmitted = () => {
    if (!mission) return;
    localStorage.setItem(respondedKey(mission.missionId), 'true');
    setJustResponded(true);
  };

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>오늘의 미션</Top.TitleParagraph>} />}>
      <Spacing size={16} />
      {loading ? (
        <LoadingState rows={1} />
      ) : !mission ? (
        <EmptyState title="오늘의 미션이 곧 열려요" />
      ) : responded ? (
        <SummaryHero
          label={MISSION_TYPE_LABEL[mission.type]}
          value={<Paragraph.Text typography="t2">{mission.title}</Paragraph.Text>}
          caption="이미 참여했어요"
          action={
            <Button
              variant="fill"
              display="block"
              onClick={() =>
                navigate('/feed', { state: { missionId: mission.missionId } as RouteState['/feed'] })
              }
            >
              피드 보기
            </Button>
          }
          testId="mission-card"
        />
      ) : (
        <>
          <SummaryHero
            label={MISSION_TYPE_LABEL[mission.type]}
            value={<Paragraph.Text typography="t2">{mission.title}</Paragraph.Text>}
            caption={mission.prompt}
            testId="mission-card"
          />
          {mission.type === 'worry' && (
            <>
              <Spacing size={8} />
              <Paragraph.Text typography="st13">익명으로 등록돼요</Paragraph.Text>
            </>
          )}
          <Spacing size={16} />
          <AiRecommendSection />
          <Spacing size={16} />
          <ResponseForm mission={mission} onSubmitted={handleSubmitted} />
        </>
      )}
      <Spacing size={24} />
    </ScreenScaffold>
  );
}
