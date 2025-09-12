# NobleVerse
## Inbox Feature

Good and useful design is the main key.

This repo includes a production-ready Inbox module powered by Supabase, shadcn/ui, and React Query.

Setup:
- Create Supabase project and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.
- Run the SQL in `utils/supabase/inbox.sql` in your Supabase SQL editor.
- In Storage, confirm a private bucket `inbox-attachments` exists (the SQL creates it) and Realtime is enabled for `rooms`, `room_participants`, `messages`, `message_reactions`.

Usage:
- Navigate to /inbox to open the two-pane chat UI.
- Left: rooms list with search. Right: messages with infinite scroll, composer with files, realtime updates.


# NobleVerse

NobleVerse, modern lojistik ve iş yönetimi için geliştirilmiş, güçlü ve esnek bir platformdur. Tüm iş süreçlerinizi tek bir çatı altında kolayca yönetmenizi sağlar.

## Özellikler

- Modern Next.js 15 altyapısı
- TypeScript ile tam güvenlik ve ölçeklenebilirlik
- Güçlü kimlik doğrulama ve kullanıcı yönetimi
- Hata takibi ve merkezi hata yönetimi
- Esnek tema ve kullanıcı arayüzü
- Gerçek zamanlı veri yönetimi ve analiz
- Kanban, ürün, profil ve daha fazlası

## Kurulum

1. Depoyu klonlayın:
  ```
  git clone <sizin-repo-linkiniz>
  ```
2. Bağımlılıkları yükleyin:
  ```
  npm install
  ```
3. Ortam değişkenlerini ayarlayın:
  ```
  cp env.example.txt .env.local
  # .env.local dosyasını doldurun
  ```
4. Geliştirme sunucusunu başlatın:
  ```
  npm run dev
  ```

## Klasör Yapısı

```
src/
├── app/
├── components/
├── features/
├── hooks/
├── lib/
├── types/
```

## Lisans

Tüm hakları saklıdır. © NobleVerse

## Realtime Chat (Supabase)

Bu proje, Supabase üzerinde gerçek zamanlı sohbet için şema içerir. `utils/supabase/setup.sql` dosyasını Supabase SQL Editor üzerinden çalıştırarak aşağıdaki yapıları kurabilirsiniz:

- Tablolar: `rooms`, `room_members`, `messages`
- RLS politikaları: Kullanıcı yalnızca üyesi olduğu odaların mesajlarını görebilir/gönderebilir
- Yardımcı fonksiyon: `public.get_or_create_direct_room(a uuid, b uuid)`
- Realtime publication: Bu tablolar Supabase Realtime yayınına eklenir

Adımlar:
1. Supabase Dashboard > SQL Editor > `utils/supabase/setup.sql` içeriğini çalıştırın.
2. Project Settings > Realtime kısmında Realtime açık olduğundan emin olun.
3. `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ortam değişkenlerini `.env.local` içine ekleyin.

İstemci tarafı kullanım:
- İki kullanıcı arasında direkt oda: RPC `public.get_or_create_direct_room` ile oda id alın.
- Mesaj ekleme: `public.messages` tablosuna `{ room_id, user_id, content }` ekleyin.
- Realtime dinleme: `public.messages` tablosunda `room_id` filtreli INSERT olaylarına abone olun.

## Tasks & Calendar

- Added migration `supabase/migrations/2025-09-06_tasks_calendar.sql` to persist tasks and personal calendar events with RLS.
- The FAB includes:
  - Tasks: lists tasks assigned to you or created by you, sourced from chat task cards; you can mark done.
  - Calendar: create events, see shipment ETAs from `requests.details.eta`, add to calendar, or copy a `calendar_card` block to paste into chat.
