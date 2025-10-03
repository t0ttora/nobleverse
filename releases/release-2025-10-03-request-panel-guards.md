# Release 2025-10-03 – Request Panel Stability & Offer View Guards

## Summary
Request detay panelinin yanlış / otomatik açılması ve offer görüntülerken seçili request'in beklenmedik şekilde değişmesi problemleri giderildi. URL parametre senkronizasyonu sadeleştirildi; panel sadece gerçek bir seçim olduğunda açılıyor ve kapanınca kalıntı `?request` / `?offer` parametreleri temizleniyor. Offer detayları açıkken farklı bir request'e geçişin oluşturduğu state çakışmaları engellendi.

## Key Fixes
- Prevented stale / unintended auto-open of `RequestDetailsPanel` (guard: panel only renders with a valid `request`).
- Automatic closing of panel when:
  - Active tab is no longer `requests`.
  - Seçili request yok (`selected === null`).
- URL hygiene:
  - On panel close: remove `request` and `offer` query params.
  - On panel open: idempotently set `?request=<id>` only.
  - Offer detail open/close now only adds/removes `offer` param; no extra param injection.
- Offer view guard: open offer dialog kapanmadan request selection değiştirme girişiminde önce dialog kapanır.
- State reset on request change: embedded offer form, compare mode, negotiation & selection state temizleniyor.
- Early return inside panel component to block heavy effect chains when data henüz gelmemişken `open=true`.

## Technical Changes
| Area | Change |
|------|--------|
| `src/app/shipments/page.tsx` | Added effects for tab / selection guards, URL param strip & sync, guarded row click while offer dialog open. |
| `src/components/requests/request-details-panel.tsx` | Added early guard (no request ⇒ no render), refined offer param sync, minor formatting & safer try/catch cleanups. |
| URL Behavior | Consistent, reversible deep-linking: `?request=<id>[&offer=<offerId>]`. |

## How to Test
1. Navigate to `/shipments` without params ⇒ No panel.
2. Click a request row ⇒ Panel opens, URL now has `?request=<id>`.
3. Close panel (ESC or overlay) ⇒ URL params cleared, refresh ⇒ Panel does not auto-open.
4. Open an offer inside panel ⇒ `?offer=<offerId>` appended. Close the offer split-view ⇒ `offer` param removed, `request` param stays.
5. Switch tab away from `Requests` ⇒ Panel closes automatically.
6. Re-select different request rapidly while an offer dialog is open ⇒ Previous dialog closes cleanly; no incorrect request swap.
7. Manually paste a URL with `?request=<id>` ⇒ Panel auto-opens with correct data.

## Edge Cases Considered
- Stale `offer` param for a different request id (ignored safely until matching request/offer set loaded).
- Rapid tab switching while loading ⇒ guard prevents orphaned open panel.
- Browser history replaceState loops avoided (idempotent checks before writing).

## No Data Migrations
Sadece frontend davranışsal düzeltmeler. Supabase şema / RLS değişmedi.

## Performance Notes
Early guard ile gereksiz effect çalışmaları (offers fetch vs.) request gelmeden engellendi; özellikle yavaş bağlantıda gereksiz round-trip azaldı.

## Future Improvements (Optional)
- Derive `panelOpen` purely from `selected` + router state (remove duplicated boolean state).
- Add toast feedback if a `?request` id no longer exists / archived.
- Unify offer compare & split-view into a lighter, lazy chunk.

## Commit Message Suggestion
```
fix: stabilize request panel auto-open & offer view state guards
```

---
Generated as part of maintenance / stability improvements on 2025-10-03.
