# Backlog Thematic Grouping

## Themes & Mapping

### P0 (Immediate Stability / Confidence)
- Syntax & Compile: #17
- Instrumentation Warning: #21
- Accessibility Core: #22
- Core Unit Tests: #24
- Error Boundaries: #27
- Analytics Events: #29
- Security Headers: #33
- Bundle Size Audit: #37
- Dependency Updates Plan: #46
- Error Telemetry Enrichment: #48

### P1 (Near-Term UX / Performance / Infra)
- Compact Secondary Toggle: #18
- Drag Scroll: #19
- oklch Feature Detection: #20
- Performance Profiling: #23
- PDF Export Resilience: #26
- Contrast Audit: #31
- i18n Readiness: #32
- Rate Limiting: #34
- Dead Code Sweep: #36
- Cache Strategy Review: #39
- CI Enhancements: #40
- Request Panel Code Split: #47
- Snapshot Data Fixtures: #45

### P2 (Polish / Strategic Enhancements)
- Visual Regression Tests: #25
- Optimistic Accept Flow: #28
- Theme Token Consolidation: #30
- Form Validation Consistency: #35
- Logging Conventions: #38
- Changelog Automation: #41
- Dark Mode Polish: #42
- Offline Handling: #43
- Keyboard Shortcuts Help: #44
- CSS Layering Cleanup: #49
- Consistent Button Sizing: #50

## Counts
- P0: 10
- P1: 13
- P2: 11

## Suggested Sequencing Notes
1. Finish P0 before starting new P1 except where low-effort quick wins (e.g., #20 detection script).
2. Run profiling (#23) before deeper performance refactors or code-splitting (#47).
3. Introduce analytics (#29) before optimizing flows so impact can be measured.

## Cross-Cutting Concerns
- Observability (#21, #29, #48, #38) should standardize payload schema early.
- Accessibility (#22, #31, #42) shares color/contrast tokens—coordinate before theme consolidation (#30).

---
Generated: Sprint Planning Support
