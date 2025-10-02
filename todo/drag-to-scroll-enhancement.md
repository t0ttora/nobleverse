# Drag-to-Scroll (Compact Offers)

## Problem
Yatay kaydırma şu an wheel ve klavye ile akıcı ama sürükleme (pointer drag) desteği yok; özellikle dokunmatik olmayan büyük ekran kullanıcıları için hızlandırıcı olabilir.

## Amaç
Compact scroller üzerinde sol mouse basılı tut – sürükle hareketini yatay scrolla map etmek.

## Teknik Taslak
- Hedef element: `compactWrapperRef.current`.
- Pointer events: `pointerdown` → capture startX + scrollLeft, `pointermove` aktifken deltaX kadar scroll, `pointerup` / `pointerleave` stop.
- Click selection conflict: Eşik (ör: 5px) aşılmadıysa drag sayma → buton tıklamaları bozulmasın.
- Cursor feedback: dragging sırasında `cursor: grabbing`.
- Passive event kullanma (preventDefault gerekebilir) → pointermove'da pasif olma.

## Edge Cases
- Seçim kaybı: pointerup window dışında → window-level listener ekle.  
- Text selection engelleme: dragging sırasında `user-select: none`.  
- Performance: requestAnimationFrame throttle (opsiyonel).  

## Kabul Kriterleri
- Minimal latency; wheel fonksiyonelliği bozulmaz.  
- Tıklanabilir butonlar (Details) drag olmadan normal çalışır.  
- Mobile/touch zaten naturally scroll yapabildiğinden ekstra overhead yok (pointer pointerType === 'mouse' ile sınırlanabilir).  
