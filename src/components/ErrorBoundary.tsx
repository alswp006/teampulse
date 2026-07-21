import { Component, type ReactNode } from 'react';
import { Top, Button } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { EmptyState } from '@/components/StateView';

/**
 * 렌더 트리 어딘가에서 예외가 던져지면 React는 전체 트리를 언마운트한다
 * (흰/검정 백지 화면 — CLAUDE.md "흰 화면 방지"). 이 경계가 그 예외를 잡아
 * 안내 화면 + 재시도 버튼으로 대체한다.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScreenScaffold top={<Top title={<Top.TitleParagraph>팀펄스</Top.TitleParagraph>} />}>
          <EmptyState
            title="화면을 불러오지 못했어요"
            description="다시 시도하면 정상적으로 열려요"
            action={
              <Button variant="weak" display="block" onClick={this.handleRetry}>
                다시 시도
              </Button>
            }
          />
        </ScreenScaffold>
      );
    }
    return this.props.children;
  }
}
