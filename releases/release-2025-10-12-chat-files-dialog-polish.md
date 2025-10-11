# Release 2025-10-12 — Chat Files Dialog Polish

## Highlights

- Dialog body reworked into a responsive grid so the file browser and preview stay visible together.
- Recent files and top-level folders now scroll horizontally with clearer selection states and metadata callouts.
- Preview sidebar returns with actionable metadata, quick open in NobleFiles, and an "Also selected" pill stack.
- Footer actions remain pinned with Cancel, Clear selection, and Add to chat card for faster sharing.

## Technical Notes

- `chat-files-dialog.tsx` now uses a grid layout with an overflow-hidden container; preview content is rendered via a shared `PreviewPanel` component.
- Added mobile-friendly fallback by inlining the preview panel below the list for viewports below the `lg` breakpoint.
- Expanded dialog width (`max-w-[92vw]` / `lg:max-w-[1120px]`) and height cap to reduce truncation across breakpoints.
- Refined selection styling (inset rings with offsets) so highlighted cards render cleanly in dark/light themes.

## TODOs & Next Steps

- Update the chat Suite Card "Open" action to deep link into NobleFiles for the selected folder/file.
- Allow sharing directly from NobleFiles (outside chat) using the same Suite Card payload so the experience stays consistent.
- Surface recipient visibility inside each shared file row (e.g., badges showing who has access) when delivering cards in chat.
- Cache recent files/folders locally to reduce loading flicker and remove redundant fetches when reopening the dialog.
- Add keyboard support (arrow navigation, Enter to toggle, Backspace to jump up a breadcrumb) for power users.
- Expand automated coverage with component tests around selection, breadcrumb navigation, and preview rendering.
