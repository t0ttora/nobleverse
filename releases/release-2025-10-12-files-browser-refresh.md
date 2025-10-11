# 2025-10-12 · Files Browser refresh and polish

## Highlights
- Split the all-in-one Files Browser into focused subcomponents for easier maintenance without regressing features.
- Reworked share popover people picker to match the inbox command palette experience, complete with cached contacts and chip interactions.
- Restored classic card previews while adding refreshed selection affordances and decluttering folder filters.

## Details
- Broke the giant `FilesBrowser` module into smaller presentation components while preserving existing behaviours.
- Upgraded selection controls with rounded checkboxes, focus states, and better keyboard support across grid and list views.
- Improved PDF preview so documents fill the entire side panel canvas.
- Moved folder filter pills beside the "New Folder" CTA to compress header chrome.
- Reintroduced legacy thumbnail previews for non-folder cards, keeping share and star actions accessible.
- Added release documentation for the share popover work and contact caching.

## Follow ups
- Wire up dedicated components to Storybook / visual regression coverage.
- Expand API test coverage for new `/preview` and `/stats` routes before publicizing them.
