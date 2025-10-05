# Compact Görünüm Secondary Alan Toggle

## Problem

Compact modda tüm alanlar (primary + secondary) kartlara yığılıyor; bilgi yoğunluğu artıyor.

## Amaç

Sadece primary alanları varsayılan gösterip secondary set için per-kart `Expand` / `Show more` toggle eklemek.

## Tasarım Notları

- Primary key listesi mevcut: `['total_price','total_price_currency','currency','transit_time','transit_time_guarantee','payment_terms','offer_validity']`
- Secondary kalan her şey.
- Toggle state kart başına (offer.id) bazlı tutulabilir: `expandedOffers: Set<string>`.
- Erişilebilirlik: Toggle butonu `aria-expanded` ve `aria-controls` kullanmalı.

## Adımlar

1. Offer kart map içinde local state yerine üst scope state (expanded set) tanımla.
2. Secondary field container'ı `hidden` / `block` koşulu ile sakla.
3. PDF export sırasında tüm alanları ZORLA göster (exporting flag).
4. Performans: Büyük setlerde re-render azaltmak için kartları `React.memo` ile sarmalamak opsiyonel.

## Kabul Kriterleri

- Varsayılan görünümde sadece primary alanlar.
- Toggle'a basınca secondary alanlar yumuşak animasyonla (opsiyonel) açılıyor.
- Export (PDF) her iki alan setini yakalıyor.
- No regression: diff highlight korunuyor.
