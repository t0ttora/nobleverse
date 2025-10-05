# 2025-10-05 — ESLint/stability batch

This release focuses on safe ESLint fixes and minor stability cleanups to keep the codebase healthy without changing behavior.

## Highlights

- Fixed a syntax issue in `request-details-panel` (owner profile fetch block) and made export error handling no-op-safe.
- Restored missing `setOpen` in profile create form to avoid runtime reference errors; underscored unused state.
- Replaced broken icon imports in `profile-header-inline` with Lucide `Settings` and cleaned unused imports.
- Made theme color indexing type-safe in settings (typed `themeColorHex` as `Record<string,string>`), kept callbacks memoized.
- Stabilized compare-offers by hoisting field definitions to a top-level constant; simplified diff deps.
- Hardened forwarder-offer-form hook dependencies: wrapped validation in `useCallback`, included in dependent hooks.
- Onboarding modal: converted username availability check to `useCallback` with a stable dependency.
- Prefixed various unused params/caught errors to satisfy `no-unused-vars` without altering behavior.

## Developer Notes

- Typecheck passes. A small set of ESLint warnings remain (mainly exhaustive-deps suggestions and a few unused vars in profile and request panels). These are non-blocking and will be addressed in a follow-up batch.
- No functional changes intended; UI/UX should remain the same.

## Next

- Continue trimming ESLint warnings: finalize OnboardingModal memo deps, tidy remaining unused vars in profile screens, and finish event param underscores in request details panel.
