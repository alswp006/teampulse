import { AdSlot } from '@/components/AdSlot';

const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? 'home-feed';

/**
 * 콘텐츠 섹션 사이 비침습 배너 — 미션 카드/응답 폼과 분리된 독립 섹션.
 * 위아래 Spacing으로 인접 요소와 거리를 둬 겹침 없이 배치한다.
 */
export function BannerSection() {
  return (
    <div data-testid="banner-section" style={{ margin: '16px 0' }}>
      <AdSlot adGroupId={AD_GROUP_ID} />
    </div>
  );
}
