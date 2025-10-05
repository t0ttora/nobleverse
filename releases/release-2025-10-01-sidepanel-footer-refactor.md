# Release Notes – 2025-10-01

## Summary

SidePanel bileşeni için tutarlı, portal tabanlı (body'ye mount edilen) yüksek z-index'li yapı ve kalıcı footer şeridi standardize edildi. Tüm form / wizard benzeri akışlar (Request oluşturma ve Offer oluşturma) artık aksiyon butonlarını SidePanel'in yerleşik footer alanında gösteriyor. Önceki portal ve sticky footer çözümleri kaldırıldı. Infinite render döngüsüne sebep olan footer state güncelleme yaklaşımı optimize edilerek performans ve stabilite artırıldı.

## Added

- `SidePanel` footer API: `footer`, `footerClassName` prop'ları.
- `onFooterChange` prop'u ile `MultiStepFreightForm` ve (embedded olmayan) `ForwarderOfferForm` aksiyonlarını dışarıya aktarma mekanizması.

## Changed

- `SidePanel` artık `ReactDOM.createPortal` ile `document.body` altında render edilerek diğer sabit elemanların (ör. FAB) üzerinde garanti konumlanıyor.
- Varsayılan `zIndexBase` 90 → 200 (panel 210, overlay 200) olarak yükseltildi.
- Panel dış boşlukları: `top/right/bottom: 0.75rem (2)`; iç scroll alanı alt padding eklendi (`pb-8`).
- Footer şeridi tek tip: yarı saydam blur, border, sabit yükseklik (`h-16`), sağa hizalı aksiyon düzeni.
- `MultiStepFreightForm` ve `ForwarderOfferForm` içindeki dahili sticky footerlara son verildi; SidePanel footer kullanılıyor.

## Fixed

- Infinite re-render ("Maximum update depth exceeded") hatası: Footer JSX her render'da yeni referans üretip parent setState tetiklediğinden oluşan döngü, memo + ref guard ile giderildi.
- FAB'ın panel üzerinde görünmesi problemi: Yüksek z-index ve portal çözümü ile giderildi.

## Removed / Deprecated

- Geçici `sidepanel-footer-slot` portal yaklaşımı (halen backward compatibility için var, fakat `TODO` ile deprecate edildi; ileride kaldırılacak).
- `useExternalFooter` prop'u (`ForwarderOfferForm`) – artık gerekli değil.

## Migration Notes

| Eski Kullanım                                                 | Yeni Kullanım                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Portal ile `document.getElementById('sidepanel-footer-slot')` | `footer` prop'a JSX veya form bileşeninden `onFooterChange` kullanımı |
| İç bileşende sticky footer div                                | Kaldır – aksiyonlar SidePanel footer'da                               |
| `useExternalFooter` (ForwarderOfferForm)                      | Sil – otomatik footer sağlanıyor                                      |

Güncelleme sonrası yapmanız gereken:

1. Kalan özel SidePanel kullanımlarında (varsa) alt aksiyon barlarını içerikten kaldırıp `footer` prop'a taşıyın.
2. `sidepanel-footer-slot` artık yeni kullanım için gerekli değil; tamamen migration tamamlandığında ilgili fallback kaldırılabilir.

## Performance & Stability

- Footer state güncellemeleri sadece gerçekten değişen referanslarda tetikleniyor (gereksiz render baskısı azaldı).
- Panel/overlay stacking mantığı sadeleşti; potansiyel UI çakışmaları minimize edildi.

## Next Steps (Öneri)

- Focus trap + ESC ile kapatma (erişilebilirlik) eklenmesi.
- Footer action pattern'ini tekrar eden durumlar için ortak `<PanelFooterActions />` bileşeni.
- Z-index ve spacing değerlerini theme token'larına taşıma.
- `sidepanel-footer-slot` fallback'ini bir sonraki major/minor release'te kaldırma planı.

## Affected Components

- `src/components/ui/side-panel.tsx`
- `src/components/requests/create-request-dropdown.tsx`
- `src/components/ui/multi-step-freight-form.tsx`
- `src/components/offers/forwarder-offer-form.tsx`
- `src/components/requests/request-details-panel.tsx`

---

Herhangi bir regresyon veya ek geliştirme isteğiniz varsa issue açabilirsiniz.
