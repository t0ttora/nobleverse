## Release Notes – 2025-10-03

## Summary

Compare Offers panelinin kompakt görünümü yeniden tasarlandı: daha hızlı karşılaştırma, daha iyi yatay gezinme ve görsel yoğunluğu azaltılmış kartlar. Detay paneli / toast katman hiyerarşisi korunurken PDF export işlevi her iki görünümde de sorunsuz çalışmaya devam ediyor.

## Added

- Compact görünümde yatay kaydırma (dikey teker hareketi yataya yönlendirme).
- Scroll snap (snap-x + snap-mandatory) ile kart hizalama.
- Dinamik kenar (left/right) fade overlay’leri (yalnızca içerik taşarsa).
- Kart içi değerler için 2 satırlı truncation (multi-line clamp).
- ArrowLeft / ArrowRight ile fokus scroller içindeyken yatay gezinme.
- Wheel -> horizontal mapping ile trackpad / mouse deneyimi iyileştirme.

## Changed

- Compact kart yapısı: grid yerine yatay akış (flex row) + scroll-snap.
- Hover’da kart border vurgusu (daha hafif görsel geri bildirim).
- Accept + diff highlight yapıları yeniden düzenlenen DOM içinde korunuyor.

## Fixed

- Detay panelinin (side details) toast bildirimi altında kalması olasılığı: yüksek z-index düzeni ile garanti altına alındı.
- Compact moda geçişte önceki dikey grid layout’unda oluşan görsel sıkışıklık giderildi.
- Yatay kaydırmada ani sıçramalar: smooth scroll + snap kombinasyonu ile azaltıldı.

## Removed / Deprecated

- Eski compact grid tasarımı (responsive columns) – yerine tek eksenli yatay akış.
- Redundant ikinci CompareOffers panel instance (çift açılma sorunu) kaldırıldı.

## Migration Notes

| Eski                             | Yeni                                    |
| -------------------------------- | --------------------------------------- |
| Grid tabanlı compact (çok kolon) | Yatay scroll + snap kartları            |
| İkincil offer panel kopyası      | Tek panel instance                      |
| Dikey sadece wheel               | Wheel delta → horizontal scroll mapping |

Güncelleme sonrası özel bir aksiyon gerekmez; ancak eğer stil üzerine manual override yapan local selektörler varsa, yeni `.nv-multi-truncate` veya snap sınıflarına uyumlu hale getirilmesi önerilir.

## Performance & Stability

- Scroll dinleyicisi passive + ResizeObserver ile hafif.
- Kart DOM yapısı sadeleştirildi (daha az nested container) – potansiyel layout reflow maliyeti azaldı.
- Diff highlight hesaplaması aynı (memoized), görsel sunum değişti.

## Next Steps (Öneri)

- Secondary alanları default gizleyip per‑card “Expand” aksiyonu.
- Drag-to-scroll (pointer down + move) opsiyonu eklenmesi.
- Orta noktaya yaklaşan kartta hafif ölçek / gölge (“focus in lane”) efekti.
- Tablet breakpoint’lerinde otomatik snap durumu ince ayarı.

## Affected Components

- `src/components/offers/compare-offers.tsx`
- `src/components/requests/request-details-panel.tsx` (tek panel instance kullanımı uyumu)

---

Geri bildirim veya ek istekler için issue açabilirsiniz.
