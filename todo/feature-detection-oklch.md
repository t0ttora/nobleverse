# oklch Feature Detection Script

## Amaç
Tarayıcı oklch() / lab() renk fonksiyonlarını desteklemiyorsa otomatik olarak `html.no-oklch` sınıfını eklemek ve RGB fallback’leri aktifleştirmek.

## Yaklaşım
```js
(function(){
  try {
    if (CSS && CSS.supports && CSS.supports('color: oklch(0.5 0.1 0)')) return; 
  } catch(_) {}
  document.documentElement.classList.add('no-oklch');
})();
```

## Entegrasyon Noktası
- `src/app/layout.tsx` head içine inline `<script>` veya küçük bir `color-support.ts` modülü.
- SSR hydration öncesi sınıf eklenmesi FOUC riskini azaltır.

## Adımlar
1. Utility script oluştur.  
2. Layout `<head>` içinde embed et (dangerouslySetInnerHTML veya inline).  
3. QA: Modern Chrome (destekli) vs eski / emülasyon (desteksiz) karşılaştırması.  

## Kabul Kriterleri
- Destek var → sınıf eklenmez, advanced renkler kullanılır.  
- Destek yok → `no-oklch` eklenir, stil fallback devreye girer.  
- Performans etkisi ihmal edilebilir (<1ms).  
