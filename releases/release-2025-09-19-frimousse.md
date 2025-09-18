# Release 2025-09-19

Bu sürüm, emoji-mart’ı tamamen kaldırıp Frimousse (v0.3.0) tabanlı hafif bir emoji picker’a geçişi ve chat mesajlarına tepki (reactions) özelliğinin Frimousse ile yeniden uygulanmasını içerir. Ayrıca paket yöneticisi uyumsuzluğu giderildi ve birkaç build hatası düzeltildi.

## Özet
- Emoji Picker: Frimousse v0.3.0 ile yeni, hızlı ve erişilebilir picker.
- Reactions: Inbox ve Shipment odalarında mesajlara emoji ile tepki verme.
- Paket Yönetimi: pnpm pinlendi; npm lockfile kaldırıldı (karışıklık giderildi).
- Supabase: Eski `@supabase/auth-helpers-nextjs` kullanımının kalanı temizlendi; ilgili route `@supabase/ssr` helper’ına taşındı.
- Build: `framer-motion` bağımlılığına gerek kalmadı; `motion/react` kullanıldı. Radix’in `VisuallyHidden` paketi yerine yerel bir `VisuallyHidden` yardımcı bileşeni eklendi.

## Değişiklikler
- src/components/ui/emoji-picker.tsx: Frimousse sarmalayıcı bileşen (onPick API korunarak).
- src/components/realtime-chat.tsx ve src/components/chat-message.tsx: Composer ve tepki popover’ları Frimousse’a geçirildi.
- src/app/api/shipments/[id]/force-status/route.ts: `@supabase/ssr` server helper’ına taşındı.
- package.json: `frimousse@^0.3.0` eklendi; `@supabase/auth-helpers-nextjs` kaldırıldı; `packageManager` pnpm olarak sabitlendi; `test` script eklendi.
- src/components/ui/visually-hidden.tsx: Erişilebilirlik için yerel `VisuallyHidden` yardımcı bileşeni.
- src/components/modal/OnboardingModal.tsx: `framer-motion` → `motion/react` geçişi.

## Nasıl Doğrulanır
- Emoji seçimi: Chat composer’daki emoji butonu ile picker açılır; seçilen emoji caret konumuna eklenir.
- Reactions: Bir mesaja tepki butonundan emoji seçildiğinde tepki anında görünür; tekrar tıklamada kaldırma davranışı (varsa) korunur.
- Build: `pnpm build` sorunsuz tamamlanır; tip hatası yok.
- Test: `pnpm test` (Vitest) başarılıdır.

## Notlar
- Frimousse versiyonu: 0.3.0
- Peer dependency uyarıları (React 19 ile bazı paketler): davranışı etkilemiyor; ilerleyen sürümlerde paketler güncellenebilir.
