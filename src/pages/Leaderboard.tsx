import { Top } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';

// TDD red-phase placeholder — intentionally unimplemented.
// See src/__tests__/packet-0011.test.ts (packet 0011) for the full spec the
// Coder must implement here: fetchLeaderboard load, my-rank-hero SummaryHero
// (rank + streak), rank-row-* rows (rank/participationCount/streak), badge-*
// Chip touch targets (>=44px), loading Skeleton x3, empty state.
export default function Leaderboard() {
  return <ScreenScaffold top={<Top title={<Top.TitleParagraph>리더보드</Top.TitleParagraph>} />}>{null}</ScreenScaffold>;
}
