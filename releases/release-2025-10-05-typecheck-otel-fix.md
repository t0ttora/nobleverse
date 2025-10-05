# Release — 2025-10-05 — Typecheck stabilization + OTEL warning fix

## Summary

- Stabilized TypeScript diagnostics by introducing a dedicated `tsconfig.typecheck.json` that excludes `.next/types` and disables incremental caching.
- Updated VS Code task and `package.json` script to use the new typecheck config for clean, authoritative checks.
- Resolved noisy OpenTelemetry dev warning by pinning `require-in-the-middle` to `7.5.2` to match `@opentelemetry/instrumentation`.
- Normalized package name to a valid npm identifier (`nobleverse`).

## Details

### TypeScript
- Added `tsconfig.typecheck.json`:
  - `incremental: false` to prevent stale cache issues.
  - Excludes `.next/types/**/*.ts` to avoid duplicate program inputs and stale diagnostics injected by Next during dev.
- Scripts/tasks:
  - `package.json` → `typecheck`: `tsc -p tsconfig.typecheck.json --noEmit`
  - `.vscode/tasks.json` → “Typecheck (tsc)” runs the same command.
- Result: `pnpm run typecheck` returns 0 errors; diagnostics now reflect on-disk sources.

### OpenTelemetry warning
- Fix dev warning: “Package require-in-the-middle can't be external … version mismatch (8.x vs 7.5.2).”
  - `package.json` dependency pinned to `require-in-the-middle@7.5.2`.
  - Added `overrides` entry to enforce the version across the tree.
  - Reinstalled dependencies.
- Result: Dev server starts without the OTEL version mismatch warning.

### Misc
- `package.json` name normalized from `NobleVerse` → `nobleverse`.

## How to validate
1) Typecheck
   - `pnpm run typecheck` → exit code 0, no TS errors.
   - Or run the “Typecheck (tsc)” task in VS Code.

2) Dev server
   - `npm run dev` (or `pnpm dev`) → server starts quickly with Turbopack.
   - No `require-in-the-middle`/OTEL warnings in the terminal.

## Follow-ups
- Lint hygiene: chip away at ~100+ warnings (unused vars/params, react-hooks deps).
- MultiStepFreightForm: remove conditional hooks and clean up `exhaustive-deps`.
- Optionally reintroduce `.next/types` to tsconfig.json only for editor intellisense if needed (keep the typecheck config separate).
