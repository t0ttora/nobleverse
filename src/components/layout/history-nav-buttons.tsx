'use client';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

/**
 * Notion benzeri ileri/geri gezinme butonları.
 * - Geri/ileri mümkün değilse disabled.
 * - Tarayıcı history state uzunluğuna güvenmek tam kesin değil; bu yüzden basit bir internal stack
 *   takibi yapıyoruz ve mount olduğunda current pathname'i kaydediyoruz.
 */
export function HistoryNavButtons() {
  const router = useRouter();
  const pathname = usePathname();

  // Persist key
  const STORAGE_KEY = 'nv.history.nav';

  type PersistShape = {
    back: string[];
    forward: string[];
    last: string | null;
  };

  const backStackRef = React.useRef<string[]>([]); // geçmiş (geri)
  const forwardStackRef = React.useRef<string[]>([]); // ileri
  const lastPathRef = React.useRef<string | null>(null);
  const replaceFlagRef = React.useRef(false); // dışarıdan replace sinyali (opsiyonel API genişletilebilir)

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pressing, setPressing] = React.useState(false);
  const longPressTimer = React.useRef<number | null>(null);
  const [, forceRender] = React.useState(0);

  // SessionStorage'dan yükle
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PersistShape = JSON.parse(raw);
        if (
          parsed &&
          Array.isArray(parsed.back) &&
          Array.isArray(parsed.forward)
        ) {
          backStackRef.current = parsed.back;
          forwardStackRef.current = parsed.forward;
          lastPathRef.current = parsed.last;
          forceRender((n) => n + 1);
        }
      }
    } catch {}
    if (!lastPathRef.current) lastPathRef.current = pathname; // İlk path kaydı
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function persist() {
    try {
      const payload: PersistShape = {
        back: backStackRef.current.slice(-200), // makul limit
        forward: forwardStackRef.current.slice(-200),
        last: lastPathRef.current
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }

  // Query filtreleme: sadece pathname segmentleri değişmişse (soru işaretinden önce) kaydet.
  function basePath(path: string) {
    const q = path.indexOf('?');
    return q === -1 ? path : path.slice(0, q);
  }

  React.useEffect(() => {
    if (lastPathRef.current === null) {
      lastPathRef.current = pathname;
      persist();
      return;
    }
    const prev = lastPathRef.current;
    if (basePath(pathname) === basePath(prev)) {
      // Sadece query değişmiş => replace gibi davran, stack'e ekleme.
      lastPathRef.current = pathname; // yine de güncel path tutalım.
      persist();
      return;
    }
    if (pathname !== prev) {
      if (!replaceFlagRef.current) {
        // normal push
        backStackRef.current.push(prev);
        forwardStackRef.current = [];
      } else {
        // replace => stack değiştirme
        replaceFlagRef.current = false;
      }
      lastPathRef.current = pathname;
      forceRender((n) => n + 1);
      persist();
    }
  }, [pathname]);

  function goBack() {
    const prev = backStackRef.current.pop();
    if (!prev) return;
    if (lastPathRef.current) forwardStackRef.current.push(lastPathRef.current);
    lastPathRef.current = prev;
    forceRender((n) => n + 1);
    persist();
    router.push(prev);
    setMenuOpen(false);
  }

  function goForward() {
    const next = forwardStackRef.current.pop();
    if (!next) return;
    if (lastPathRef.current) backStackRef.current.push(lastPathRef.current);
    lastPathRef.current = next;
    forceRender((n) => n + 1);
    persist();
    router.push(next);
  }

  function jumpTo(indexFromEnd: number) {
    // indexFromEnd=0 en son, 1 bir önceki ...
    const idx = backStackRef.current.length - 1 - indexFromEnd;
    if (idx < 0) return;
    const target = backStackRef.current[idx];
    // Seçilen hedefin üstündeki tüm öğeleri forward'a aktar
    const moved = backStackRef.current.splice(idx + 1); // hedefin üstündekiler
    if (lastPathRef.current) moved.unshift(lastPathRef.current);
    forwardStackRef.current.push(...moved);
    // Geri kalan backStackRef current'ta kaldı (target en sonda değil, hala duruyor)
    // Şimdi target'ı da en sondan çıkarıp forward'a koymamamız lazım; mantık: target'a gidiyoruz.
    const trail = backStackRef.current.pop();
    if (trail !== target) {
      // Beklenmeyen durum; güvenlik için target'ı trail yap
      lastPathRef.current = trail || target;
    } else {
      lastPathRef.current = target;
    }
    forceRender((n) => n + 1);
    persist();
    router.push(target);
    setMenuOpen(false);
  }

  const canGoBack = backStackRef.current.length > 0;
  const canGoForward = forwardStackRef.current.length > 0;

  // Long press detection (500ms)
  function handlePressStart() {
    if (!canGoBack) return;
    setPressing(true);
    longPressTimer.current = window.setTimeout(() => {
      setMenuOpen(true);
    }, 500);
  }
  function handlePressEnd() {
    setPressing(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  const recent = backStackRef.current.slice(-5).reverse(); // son 5 (en son üstte)

  return (
    <div className='bg-muted/50 ring-border/50 relative flex items-center gap-1 rounded-md p-0.5 shadow-sm ring-1'>
      <div className='flex items-center gap-1'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label='Geri'
          disabled={!canGoBack}
          onClick={() => {
            if (pressing) return; // long press menüsü açıldıysa tek tık yeme
            goBack();
          }}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          className='text-muted-foreground hover:text-foreground h-7 w-7 rounded-sm disabled:opacity-40'
        >
          <Icons.chevronLeft size={16} />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label='İleri'
          disabled={!canGoForward}
          onClick={goForward}
          className='text-muted-foreground hover:text-foreground h-7 w-7 rounded-sm disabled:opacity-40'
        >
          <Icons.chevronRight size={16} />
        </Button>
      </div>
      {menuOpen && recent.length > 0 && (
        <div
          className='bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 absolute top-full left-0 z-50 mt-1 w-56 overflow-hidden rounded-md border shadow-md'
          onMouseLeave={() => setMenuOpen(false)}
        >
          <ul className='max-h-64 overflow-y-auto py-1 text-sm'>
            {recent.map((p, i) => {
              const display = p.replace(/^\//, '') || 'home';
              return (
                <li key={p + i}>
                  <button
                    onClick={() => jumpTo(i)}
                    className='hover:bg-accent hover:text-accent-foreground w-full px-3 py-1.5 text-left'
                  >
                    {display.length > 40 ? display.slice(0, 37) + '…' : display}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default HistoryNavButtons;
