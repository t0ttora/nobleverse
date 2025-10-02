# Sprint 1 Plan (Stability & Observability)

## Scope (P0 Focus)
Aims to restore structural stability, eliminate noisy build warnings, and establish minimal test & analytics foundation.

Included Backlog Items:
- #17 Request panel syntax repair
- #21 Instrumentation warning mitigation
- #22 A11y pass compare panel
- #24 Unit tests core utils
- #29 Analytics events
- #37 Bundle size audit
- #46 Dependency updates plan
- #48 Error telemetry enrichment

## Objectives
1. Build: Zero TypeScript syntax errors in `request-details-panel.tsx`.
2. Observability: Remove (or justify & document) OpenTelemetry/Sentry critical dependency warning.
3. Accessibility: Compare dialog keyboard trap & ARIA roles correct; tab loop verified.
4. Quality: Core utils (diff detection, ordering) have test coverage (≥4 focused tests, green).
5. Analytics: Events emitted via instrumentation helper (at least 3: mode change, accept attempt, accept success/fail).
6. Performance Insight: Bundle size audit doc capturing top 5 largest chunks + action items.
7. Upgrades: Draft of dependency upgrade matrix (risk, test plan, target versions).
8. Telemetry Enrichment: Error events carry contextual IDs (requestId, offerIds[], viewMode).

## Exit Criteria Checklist
- [ ] `pnpm exec tsc --noEmit` passes with 0 new errors.
- [ ] No "Critical dependency" warning during build OR documented mitigation rationale.
- [ ] Keyboard navigation cycle (Tab, Shift+Tab, ESC) verified manually in compare dialog.
- [ ] `vitest run` shows new passing tests for utils (diff, ordering, pdf export trigger stub).
- [ ] Console/network shows structured analytics events with payload schema.
- [ ] `docs/bundle-audit.md` created with before/after size notes.
- [ ] `todo/dependency-upgrade-plan.md` drafted.
- [ ] Error telemetry payload example captured in `docs/telemetry-examples.md`.

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Deep corruption in request panel code | Delays sprint | Strip to skeleton, reintroduce sections incrementally |
| Sentry/OTEL warning persists | Noise in CI | Conditional import or version pin rollback |
| Time overrun on tests | Reduced coverage | Start with smallest pure functions first |

## Implementation Order (Suggested)
1. (#17) Syntax repair
2. (#24) Unit tests (lock behavior)
3. (#22) Accessibility improvements
4. (#29 + #48) Analytics & enriched telemetry
5. (#21) Instrumentation warning resolution
6. (#37) Bundle size audit & doc
7. (#46) Dependency upgrade plan & doc

## Definitions
P0 = Blocks stability/observability or undermines confidence.

---
Owner: TBD  | Duration: 1 Sprint (1 week target)
