# Release — 2025-11-01 — Team collaboration & share polish


## Overview

This release focuses on elevating the Team tab into a collaboration hub and polishing sharing workflows. It introduces standardized team cards, richer per-card and bulk actions, a Quick Share dialog with a dedicated Docs tab, and a calmer, more consistent hover/selection experience.


## Highlights

- Team cards redesigned (vertical, minimal) with standardized header/footer, labels chips, and presence/last-active.
- Multi-select + bulk actions: start group chat, send message, assign tasks, schedule meetings, edit labels.
- Per-card Assign dropdown with Task/Event/Shipment/Request dialogs.
- QuickShareDialog: Recent/Search/Docs tabs; dedicated Docs source; send-to-inbox and share-link flows; image thumbnails; tab state persistence.
- Mention flows: mention via NewMessageDialog and one-click “Mention in Inbox” (jumps to DM).
- Thread creation with persistent title + optional topic.
- LabelsDialog with autocomplete and single/bulk edit; labels shown as chips.
- TeamInvite enhancements: link copy, QR, CSV import, group chat CTA.
- Calmer, minimal hover behavior on team cards (no scale/border color flash).
- Settings: Team Management bölümü eklendi; Store ve Products ayarları kaldırıldı; takım verisi `settings.org.team` altında saklanıyor; Save/Discard ve dirty-state akışları tutarlı hale getirildi.
- AI Prompt Composer: Help menüsündeki Docs/Settings girişleri input’a token ekliyor; ek olarak küçük bir düzeltme ile token ekleme (appendToken) davranışı iyileştirildi.


## Details

### Team tab & cards

- New `TeamMemberCard` layout with:
  - Avatar, name, username; presence dot; minimal last-active (clock + relative time tooltip).
  - Role shown as a display-only badge (selector removed).
  - Labels (tags/departments) rendered as chips.
  - Header/footer standardized; footer buttons: +Tags, +Dept, Message, Assign dropdown (Task/Event/Shipment/Request), View.
  - Overflow menu: Start thread, Share doc, Mention, Mention in Inbox.
- Hover polish: removed scale and colored ring/border on hover; subtle background only.

### Selection & bulk actions

- Checkbox appears on hover (top-left); overflow menu top-right.
- Bulk bar actions:
  - Start group chat
  - Send message (prefilled recipients)
  - Assign tasks (title + optional due)
  - Schedule meeting (mini calendar, time, note)
  - Edit labels (bulk preserve/merge semantics)

### Share & Mention

- New `QuickShareDialog`:
  - Tabs: Recent (filter), Search (server query), Docs (dedicated `nv_docs` source with title search).
  - Remembers last selected tab across opens.
  - Thumbnails for image files via preview endpoint.
  - Split actions:
    - Send to Inbox: shares files via API and posts doc links to DM/group.
    - Share link: builds signed file links (fallback to public) and `/nobledocs/{id}` links for docs; copies to clipboard.
- Mention improvements:
  - NewMessageDialog supports `presetText` for a Mentions block.
  - "Mention in Inbox" navigates to or creates the DM room, jumping straight to conversation.

### Threads

- Start thread from card: prompt for title and optional topic; creates a group room; inserts a "Topic:" message when provided.

### Labels

- `LabelsDialog` offers autocomplete suggestions compiled from existing labels.
- Single edit preserves existing unless changed; bulk edit merges into existing.

### Assign dialogs

- Task/Event: create task or calendar event and send notifications.
- Shipment/Request: open the Shipments workspace to create/link (CTAs for now; can be wired to concrete flows).

### Scheduling

### Settings

- Yeni Team Management sekmesi: Üyeler listesi, roller (Owner/Admin/Member/Viewer) ve davetler (pending/accepted/expired) yönetimi.
- Davet ekleme (e‑posta + rol), bekleyen davetleri iptal etme ve temel uyarılar (duplication vb.).
- Kayıt/discard akışları section-bazlı çalışır; sadece Team değişiklikleri yazılır.
- “Store Settings” (firma adı/website) ve “Products Settings” tamamen kaldırıldı; arayüz ve durum yönetimi temizlendi.
- Persistans: sadece `settings.org.team = { members, invites }` yazılır/okunur.

### AI Prompt Composer

- Help menüsündeki “Docs” ve “Settings” öğeleri, metin alanına küçük yardımcı token’lar ekler (Enter ile gönder akışını bozmadan).
- Zaten mevcut olan eklenti menüsü/çipler deneyimi korunurken, eksik `appendToken` fonksiyonu eklendi ve davranış stabilize edildi.

- Bulk schedule with MiniCalendar-like UX (date, time, note) and invite notifications.


## Technical notes

- Supabase: RPCs used `get_or_create_dm_room`, `create_group_room`.
- Docs data: `nv_docs` table used for dedicated Docs tab; editor lives under `/nobledocs/[id]`.
- Shared files API: `/api/noblesuite/files/share`.
- Preview endpoint: `/api/noblesuite/files/preview?id=...` for thumbnails.
- Settings persistence: roles/labels under `settings.org.team`.
- Settings cleanup: “Store/Products” bölümleri ve bunlara ait state/savelogic kaldırıldı; artık sadece `org.team` alanı güncelleniyor.
- AI composer: Help → Docs/Settings token ekleme, basit bir append fonksiyonu ile uygulandı; mevcut attach/insert menüsü ve çipler yapısı ile uyumlu.


## How to test

- Team tab: verify filters (presence/role/search), selection behavior, card hover minimalism.
- Card actions: Message, Assign variants, Start thread, Share doc, Mention.
- Bulk actions: create group chat/message/tasks/events; edit labels; clear selection.
- QuickShareDialog: Recent, Search, Docs tab search; image thumbnails; Send to Inbox vs Share link.
- Settings → Team Management: Üye ekleme/çıkarma, rol değiştirme, davet ekleme/iptal; Save ve Discard’ın yalnızca bu section’daki değişiklikleri etkilediğini doğrulayın.
- Settings sol menüde “Store Settings” ve “Products Settings” öğelerinin görünmediğini doğrulayın.
- AI Prompt Composer → Help → Docs/Settings tıklayın; input’a token eklendiğini ve Enter ile gönderimde sorun olmadığını doğrulayın.


## Known gaps

- Shipment/Request assign flows still act as navigation CTAs; needs concrete create endpoints or UI route with prefill params.
- Docs sharing currently posts links; permissioned shares could be added via a `nv_doc_shares` model and API.
- Team Management şu an `settings.org.team` JSONB alanını kullanıyor; daha gelişmiş yetkilendirme/organizasyon yapısı için `organizations`, `org_members`, `org_invites` tablolarına taşınabilir.


## To do (next)

- If you’d like, we can also add a “Link preview” UI (like the files browser’s “Share Links” dialog) to show and copy each generated link individually instead of relying entirely on clipboard.
- If you want “Share link” for docs to enforce permissions beyond just visible links, we can add an `nv_doc_shares` table and a small API; I can scaffold that when you’re ready.
- If you also want me to wire Assign → Shipment/Request into actual create flows, point me to the preferred endpoint/params (or UI route) and I’ll plug that in next.
- Optional: add per-item selection counters and file size/type badges in QuickShare.
- Optional: add message template when sending docs to Inbox (e.g., note + cc list).
- Optional: Docs tab sort by updated/title and show owner avatars.
