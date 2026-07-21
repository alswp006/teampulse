import type { Mission } from '@/lib/types';

// TDD red-phase placeholder — intentionally unimplemented.
// See src/__tests__/packet-0008.test.ts (packet 0008) for the full spec the
// Coder must implement here: multiline TextArea + char counter/anonymous notice,
// blank/whitespace rejection, 300-char clamp, draft auto-save/restore, submit
// (createResponse) + success toast + clearDraft + onSubmitted callback + keyboard dismiss.
export function ResponseForm(_props: { mission: Mission; onSubmitted: () => void }) {
  return null;
}
