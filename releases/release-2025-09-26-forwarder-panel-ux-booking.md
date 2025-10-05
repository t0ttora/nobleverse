# Release: 2025-09-26 Forwarder Panel UX & Booking Flow Improvements

## Major Features & UX Changes

- **SidePanel Floating & Modernized**

  - SidePanel artık köşeleri daha yuvarlatılmış, ekran kenarlarından boşluklu ve gölgeli şekilde "float" ediyor.
  - Responsive ve z-index ayarlı: Nested paneller (örn. detay) üstte açılır.

- **Forwarder Header & Booking Flow**

  - Tek giriş noktası: "Create offer" butonu.
  - Panel başlığı altında küçük "or New booking" ve tooltip ile dropdown (ikonlu) freight türü seçimi.
  - Dropdown'dan tür seçince booking formu doğrudan o türle açılır, tekrar tür seçtirmez.

- **Request Browser (İstekler Listesi) Revizyonu**

  - Toolbar'da filtre ve sıralama ayrı butonlar.
  - Aktif filtreler ve sıralama seçimleri chip/rozet olarak gösteriliyor, X ile temizlenebiliyor.
  - Freight türü ve sort seçenekleri ikonlu.
  - Multi-sort: offers ve budget birlikte seçilebilir, dengeli skor algoritması.
  - Tüm UI İngilizce.

- **Booking Form (MultiStepFreightForm) Geliştirmeleri**

  - Footer artık panel içinde sticky, tüm sayfayı kaplamıyor.
  - marginBottom hack kaldırıldı, içerik overflow-y-auto.
  - Preview ve adım geçişlerinde aynı sticky footer yapısı.

- **FAB (Floating Action Button) Z-index Fix**
  - FAB artık SidePanel'in altında kalıyor (z-40), panel açıldığında asla üstte görünmüyor.

## Fixes & Minor

- Request details paneli, ana sidepanel'in üstünde açılır (zIndexBase=90).
- Booking ve offer flow'ları ayrışık, UI/UX tutarlı.
- Kodda gereksiz tekrarlar ve eski margin/padding hack'leri temizlendi.

## Developer Notes

- SidePanel, sticky footer ve FAB z-index ayarları ile overlay hiyerarşisi netleştirildi.
- İleride portal tabanlı footer slot veya global context ile daha esnek panel/overlay yönetimi yapılabilir.

---

Tüm değişiklikler 26 Eylül 2025 tarihinde tamamlandı.
