# Release 2025-09-21: Minimal Chat Username & UI Polish

## ✨ New & Improved
- Chat mesajlarında avatar tamamen kaldırıldı, sadece @kullanıcıadı küçük puntoda gösteriliyor.
- Username yazı boyutu daha küçük ve minimal hale getirildi.
- Koddan tüm avatar ve ilgili state/efektler temizlendi.

## 🛠️ Teknik
- `src/components/chat-message.tsx` dosyasında avatar ile ilgili tüm JSX ve state kaldırıldı.
- Username için sadece `@username` ve küçük puntolu bir `<span>` kullanıldı.
- Okundu bilgisi, reaksiyonlar ve hover kartlarda da avatar yerine baş harfli yuvarlak badge gösteriliyor.

## 🔄 Diğer
- Kodda gereksiz kalan import ve efektler temizlendi.
- Tüm değişiklikler tip kontrolünden geçti (`pnpm exec tsc --noEmit`).

---

Bu sürümle birlikte chat arayüzü daha sade ve okunabilir hale geldi. Geri bildirimleriniz için teşekkürler!
