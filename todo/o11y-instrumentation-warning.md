# OpenTelemetry / Sentry Instrumentation Uyarısı

## Gözlenen Uyarı
Build sırasında: `Critical dependency: the request of a dependency is an expression` (OpenTelemetry instrumentation zinciri üzerinden Sentry).

## Tahmini Sebep
Dinamik `require` benzeri bir pattern (ör: `require(modName)`) tree-shake edilemiyor ve Webpack (veya Next compiler) kritik bağımlılık uyarısı veriyor.

## Etki
- Prod build başarılı ama bundle analizinde potansiyel şişme.
- Tree-shaking kısıtlı: gereksiz otel enstrüman paketleri dahil olabilir.

## Olası Çözümler
1. Sentry / OTel paket versiyon güncellemesi (9.19.0 → en yeni) – dynamic import refactor gelmiş olabilir.
2. Manuel instrumentation azaltma: Kullanılmayan auto-instrumentation disable.
3. Webpack alias: Problemli modülü no-op stub ile eşleştirmek (risk: telemetry kaybı).
4. Kod bölme: Dinamik import ile yalnızca gerekli ortamda yükleme (server-only ayırma).

## Önerilen Yol
- Önce paket güncellemelerini gözden geçir (minor bump).  
- Ardından bundle analizi (next build + `ANALYZE=true`) ile kazanç ölç.  

## Kabul Kriterleri
- Build uyarısı kalkar ya da minimize edilir.  
- Telemetry (error + performance) temel fonksiyonlar bozulmaz.  
