# Release Notes – 2025-09-25 Settings Dialog & Appearance Overhaul

## Major Changes

- **Settings Dialog Height**

  - Dialog yüksekliği tekrar eski haline (h-[85vh] / max-h-[85vh]) getirildi. Sadece içerik ScrollArea içinde kayıyor.

- **Appearance (Görünüm) Sekmesi Yenilendi**

  - "Theme Mode" (Açık/Koyu/Otomatik) seçenekleri, görsel önizlemeli kartlarla sunuluyor.
  - "Brand Color" etiketi "Theme Color" olarak değiştirildi. Seçilen renk, tüm UI'da accent/primary olarak anında uygulanıyor.
  - Tab underline ve seçim ringleri artık `var(--primary)` ile accent rengine uyumlu.
  - Theme Color ve Theme Mode ayarları kaydediliyor ve discard/reset ile geri yükleniyor.

- **UI Scale (Arayüz Ölçeği) Özelliği**

  - "UI Scale" satırı eklendi. Slider ile %75–%150 arası ölçek ayarlanabiliyor.
  - Değişiklikler canlı olarak tüm arayüze uygulanıyor (kökte font-size değişiyor).
  - Ayar kaydediliyor ve discard/reset ile geri yükleniyor.

- **Separator Düzeni**

  - Tüm ayarlar sekmelerinde (Profile, Notifications, Language, Privacy, Integrations, Org, Offers, Billing, Shipping) kart/rounded yapılar kaldırıldı, Row + dashed separator düzeni uygulandı.

- **NobleID**
  - "Noble ID" artık doğrudan `profiles.nobleid` alanından okunuyor ve gösteriliyor. Discard/reset akışında da güncel değer çekiliyor.

## Teknik Detaylar

- Prefill, save ve discard akışları Theme Color, Theme Mode ve UI Scale için güncellendi.
- Accent rengi ve ölçek değişikliği anında CSS değişkenleriyle uygulanıyor.
- Typecheck ve testler sorunsuz geçti.

---

Tüm bu değişiklikler, kullanıcı deneyimini ve görsel tutarlılığı artırmak için yapılmıştır. Geri bildirimlerinizle daha da iyileştirilebilir.
