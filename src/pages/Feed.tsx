import { Top } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';

// TDD red-phase placeholder — intentionally unimplemented.
// See src/__tests__/packet-0010.test.ts (packet 0010) for the full spec the
// Coder must implement here: mission filter chips, sorted feed list,
// optimistic reaction +1/rollback, anonymous author label, empty/loading states.
export default function Feed() {
  return <ScreenScaffold top={<Top title={<Top.TitleParagraph>피드</Top.TitleParagraph>} />}>{null}</ScreenScaffold>;
}
