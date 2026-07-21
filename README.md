# TeamPulse

앱인토스 (Vite + React + TDS) 재택근무 확산으로 팀 결속력이 약해지고 있지만 기존 팀빌딩 솔루션은 시간이 오래 걸리거나 형식적인 문제를 해결하는 비동기 마이크로 팀빌딩 플랫폼 한국 IT 기업들이 재택/하이브리드 근무를 도입하면서 팀원 간 유대감이 급격히 떨어지고 있습니다. Zoom 회식이나 MT는 시간이 많이 걸리고 부담스러우며, 형식적인 아이스브레이킹은 실질적 효과가 없습니다. Forbes 조사에 따르면 원격근무 팀의 60%가 '팀 결속력 약화'를 최대 고충으로 꼽았으나, 짧은 시간에 자연스럽게 팀빌딩할 수 있는 도구가 부족합니다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Feed` | Feed |
| `/Home` | Home |
| `/Leaderboard` | Leaderboard |
| `/Onboarding` | Onboarding |
| `/Report` | Report |
| `/home/AiRecommendSection` | AiRecommendSection |
| `/home/ResponseForm` | ResponseForm |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-07-21
