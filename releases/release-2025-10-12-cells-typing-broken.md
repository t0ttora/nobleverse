# Noble Cells status – 2025-10-12

Status: Degraded (typing into cells is still unreliable)

Summary
- We integrated UniverJS Sheets and wired autosave and layout.
- Typing into grid cells is inconsistent; focus sometimes lands on toolbar (e.g., font size) instead of inline editor.
- A temporary routing fix is in place to force-open the inline editor and seed the first key, but it’s not fully reliable yet.

Impact
- Users can open the sheet and navigate, but entering text may fail intermittently.
- Formula bar and toolbar inputs may steal focus in some flows.

Next steps
- Investigate invoking Univer internal commands/services to programmatically open the cell editor and set text.
- Harden focus/keyboard routing and reduce toolbar focus capture.

Notes
- Build is stable. Known warnings about require-in-the-middle (OpenTelemetry) are non-blocking.
- Backend sheet_data JSONB APIs are in place; unauthenticated requests fall back to default workbook JSON in the client.

Tracking
- Page: src/features/cells/components/univer-sheet.tsx
- Recent change: inlined grid-area check to fix ReferenceError at runtime.
