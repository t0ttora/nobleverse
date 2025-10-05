# request-details-panel.tsx Hatalarının Düzeltilmesi

## Problem

TypeScript build sırasında `request-details-panel.tsx` içinde çok sayıda (200+) hata görülüyor. Önceden bozulmuş template literal / JSX blokları (özellikle ~900-930 ve 1180+ satırları civarı) parse sorunlarına yol açıyor.

## Amaç

- Yapısal (syntax) bozulmaları bulup düzeltmek.
- Hatalı kırılmış backtick, `${}` gövdeleri veya kapanmamış tag/parantezleri onarmak.
- Kodun önce minimal derlenebilir haline gelmesini sağlamak, ardından küçük refactor (gerekiyorsa).

## Önerilen Adımlar

1. İlgili satırlar civarında blok okuması yap (büyük parça halinde).
2. Kırılmış template literal segmentlerini tespit et (ör: backtick içinde satır atlaması + kapanma eksikliği).
3. Yanlış yerde duran JSX kapanışlarını (`</div>` vs) temizle.
4. Geçici olarak karmaşık string interpolation kısımlarını basit sabit metne indir (fail fast).
5. Derleme al → kalan hatalar için yinele.
6. Orijinal davranışı geri yükle (gerekirse diff highlight mantığı gibi).

## Kabul Kriterleri

- Dosya tek başına TypeScript hatasız derleniyor.
- Compare / Accept / Selection işlevleri etkilenmeden kalıyor (yan fonksiyonellik bozulmuyor).
- Kod stili repository geneline uyumlu (Tailwind sınıfları korunuyor).

## Notlar

- Bozuk blokları tamir ederken önce minimal çalışır versiyon > sonra incremental restore stratejisi tercih edilecek.
- Gerekirse geçici `// FIXME` işaretleri ile lokal alanlar belirlenecek.
