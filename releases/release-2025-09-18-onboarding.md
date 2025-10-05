# Release 2025-09-18 (Onboarding & PixelBlast)

Bu ara sürüm, onboarding modalının sağ panelindeki PixelBlast çerçevesinin yerleşimini ve köşe radius davranışını yeniden düzenler; önceki görsel hiyerarşiye sadık kalınarak Dark Mode ve responsive uyumluluk korunur.

## Özet

- PixelBlast paneli için sabit ve net iç boşluklar: sağ, üst ve alt 10px; sol 0px. Kart içerikle hizalanır.
- İç çerçeve radius, dış kart radius'undan 8px eksik olacak şekilde ayarlandı; mevcut durumda dış `rounded-lg (8px)` olduğundan iç çerçeve `rounded-none`.
- Onboarding akışının geri kalanı (rol seçimi, NobleID, konum, takım boyutu) görsel olarak rafine kaldı; işlevsel değişiklik yapılmadı.

## Teknik Değişiklikler

- Dosya: `src/components/modal/OnboardingModal.tsx`
  - Sağ panel sarıcı: `p-2` -> `pt-2.5 pb-2.5 pr-2.5 pl-0` (10px üst/alt/sağ, sol 0px).
  - İç çerçeve: `rounded-lg` -> `rounded-none` (dış radius 8px ise iç 0px kuralını karşılar), `overflow-hidden` korunarak içerik kırpması sağlandı.

## Kalite Kontrolleri

- ESLint: 0 hata, sadece uyarılar (mevcut codebase genelinde). CI kırıcı bir sorun yok.
- Build: `next build` başarıyla tamamlandı. Production optimizasyonları uygulandı.

## Notlar

- Tailwind ölçekte 10px için `2.5` kullanılmaktadır; farklı ölçeklerde tam piksel sınıfı `pt-[10px]` tercih edilebilir.
- Dış kart radius'u ileride değişirse; iç çerçeve radius'u "dış − 8px" kuralına göre yeniden ayarlanmalıdır.
