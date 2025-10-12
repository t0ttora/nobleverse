'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Univer, LocaleType, UniverInstanceType } from '@univerjs/core';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';

function defaultWorkbook(): any {
  const wbId = 'wb-1';
  const shId = 'sheet-1';
  return {
    id: wbId,
    name: 'Workbook',
    appVersion: '0.10.10',
    sheetOrder: [shId],
    sheets: {
      [shId]: {
        id: shId,
        name: 'Sheet 1',
        cellData: {},
        rowCount: 200,
        columnCount: 50,
        rowData: {},
        columnData: {}
      }
    }
  };
}

export default function UniverSheet({ sheetId }: { sheetId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const univerRef = useRef<Univer | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  // Debug UI state
  const [debugInfo, setDebugInfo] = useState<null | {
    lastKey?: string;
    from?:
      | 'win-capture'
      | 'win-bubble'
      | 'doc-capture'
      | 'doc-bubble'
      | 'container'
      | 'canvas';
    defaultPrevented?: boolean;
    activeTag?: string;
    activeClasses?: string;
    targetTag?: string;
  }>(null);
  const debugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('cellsDebug') === '1';
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);
  // Store a first printable key pressed before editor is open
  const pendingKeyRef = useRef<string | null>(null);
  const lastGridPointerRef = useRef<boolean>(false);
  // Note: Avoid forcing focus on mousedown; let Univer manage focus for its inline editor.
  useEffect(() => {
    let disposed = false;
    (async () => {
      setLoading(true);
      // Load existing sheet_data (fallback to default if unauthenticated or any error)
      let data: any = defaultWorkbook();
      try {
        const res = await fetch(
          `/api/noblesuite/cells/sheets/${sheetId}/data`,
          {
            cache: 'no-store'
          }
        );
        if (res.ok) {
          const json = await res.json();
          const maybe = json?.item?.sheet_data;
          if (
            maybe &&
            typeof maybe === 'object' &&
            Object.keys(maybe).length > 0
          ) {
            data = maybe;
          }
        }
      } catch {
        // ignore and use default workbook
      }

      if (disposed || !containerRef.current) return;

      // Prepare container BEFORE plugin registration so UI measures correct size
      const root = containerRef.current;
      // Ensure visible area and interaction for canvas-based renderer
      root.style.minHeight = '75vh';
      root.style.height = '75vh';
      root.style.width = '100%';
      root.style.position = 'relative';
      root.style.overflow = 'visible';
      root.style.zIndex = '40';
      root.style.pointerEvents = 'auto';

      const univer = new Univer({
        locale: LocaleType.EN_US,
        // Provide a minimal locale bundle so LocaleService is initialized before any plugin translations run
        locales: {
          [LocaleType.EN_US]: {}
        } as any
      });
      // Some plugins access LocaleService during activation. Ensure it's initialized before registering any plugin.
      try {
        (univer as any).setLocale?.(LocaleType.EN_US);
      } catch {}
      univerRef.current = univer;
      // Register render engine first, then UI (with prepared container), then docs + docs UI, then sheets core, sheets UI, sheets formula
      univer.registerPlugin(UniverRenderEnginePlugin);
      univer.registerPlugin(UniverUIPlugin, { container: root });
      // Docs provides the editor service used by Sheets formula bar and text editing
      try {
        univer.registerPlugin(UniverDocsPlugin);
      } catch {}
      try {
        univer.registerPlugin(UniverDocsUIPlugin);
      } catch {}
      univer.registerPlugin(UniverSheetsPlugin);
      // Place Sheets UI before Formula to ensure UI controllers are active
      univer.registerPlugin(UniverSheetsUIPlugin);
      try {
        univer.registerPlugin(UniverSheetsFormulaPlugin);
      } catch {}
      // Create or load workbook (try helper; fallback to createUnit enum value for sheet)
      let unit: any = null;
      try {
        unit =
          (univer as any).createUniverSheet?.(data) ||
          univer.createUnit(UniverInstanceType.UNIVER_SHEET, data);
      } catch {
        try {
          unit = (univer as any).createUnit?.(1, data);
        } catch {}
      }
      (univerRef.current as any).__unit = unit;
      // Let Univer manage focus. Prefer focusing the container, not the canvas.
      try {
        root.focus();
      } catch {}
      setLoading(false);

      // Auto-save debounced
      let timer: any = null;
      const save = async () => {
        if (!univerRef.current) return;
        // Prefer unit snapshot if available
        const snapshot = (univerRef.current as any).__unit?.toJson?.() ?? data;
        await fetch(`/api/noblesuite/cells/sheets/${sheetId}/data`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheet_data: snapshot })
        });
      };
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(save, 500);
      };
      // Very simple change hook: listen to document changes via global event bus if available
      (univer as any).on?.('render:changed', schedule);

      // Debug event taps (non-intrusive): observe keydown flow without preventing default
      const logEvent =
        (
          where:
            | 'win-capture'
            | 'win-bubble'
            | 'doc-capture'
            | 'doc-bubble'
            | 'container'
            | 'canvas'
        ) =>
        (e: KeyboardEvent) => {
          if (!debugEnabled) return;
          const printable = e.key && e.key.length === 1;
          const interesting =
            printable ||
            ['Backspace', 'Delete', 'F2', 'Enter', 'Escape'].includes(e.key);
          if (!interesting) return;
          const active = document.activeElement as HTMLElement | null;
          const info = {
            lastKey: e.key,
            from: where,
            defaultPrevented: e.defaultPrevented,
            activeTag: active?.tagName,
            activeClasses: active?.className?.toString()?.slice(0, 120),
            targetTag: (e.target as HTMLElement | null)?.tagName
          };
          // eslint-disable-next-line no-console
          console.debug('[CellsDebug]', info);
          setDebugInfo(info);
        };
      const winCap = logEvent('win-capture');
      const winBub = logEvent('win-bubble');
      const docCap = logEvent('doc-capture');
      const docBub = logEvent('doc-bubble');
      window.addEventListener('keydown', winCap, { capture: true });
      window.addEventListener('keydown', winBub);
      document.addEventListener('keydown', docCap, { capture: true });
      document.addEventListener('keydown', docBub);
      const containerEl = containerRef.current;
      // Geometry helpers to distinguish toolbar vs grid area
      const getContainerRect = () => containerEl?.getBoundingClientRect?.();
      const isInGridArea = (el: HTMLElement | null) => {
        if (!el || !containerEl) return false;
        const crect = getContainerRect();
        const rect = el.getBoundingClientRect?.();
        if (!crect || !rect) return false;
        // Heuristic: anything in the top ~80px relative to container is toolbar; grid starts below
        const toolbarThreshold = crect.top + 80;
        return rect.top > toolbarThreshold;
      };
      // Capture printable key to seed editor after it appears
      const containerListener = (e: KeyboardEvent) => {
        logEvent('container')(e);
        const active = document.activeElement as HTMLElement | null;
        const isActiveInput = !!(
          (active &&
            (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) ||
          (active && (active as any).isContentEditable)
        );
        // Inline helper (avoid ordering issues) to detect toolbar descendants
        const isToolbarLocal = (el: HTMLElement | null) => {
          let node: HTMLElement | null = el;
          while (node && node !== document.body) {
            const role = node.getAttribute?.('role');
            const classes = (node.className || '').toString().toLowerCase();
            const dataRegion = node.getAttribute?.('data-region') || '';
            if (
              role === 'toolbar' ||
              dataRegion.toLowerCase() === 'toolbar' ||
              classes.includes('toolbar') ||
              classes.includes('menubar') ||
              classes.includes('menu') ||
              classes.includes('dropdown') ||
              classes.includes('select') ||
              role === 'combobox' ||
              role === 'listbox' ||
              node.getAttribute?.('aria-haspopup') === 'listbox'
            ) {
              return true;
            }
            node = node.parentElement as HTMLElement | null;
          }
          return false;
        };
        // If focus is on Univer toolbar input, reroute to grid editor
        const printable =
          e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        const editKeys = e.key === 'Backspace' || e.key === 'Delete';
        if (
          isActiveInput &&
          isToolbarLocal(active) &&
          (printable || editKeys)
        ) {
          pendingKeyRef.current = e.key;
          try {
            (active as HTMLElement).blur();
          } catch {}
          try {
            containerEl?.focus();
          } catch {}
          try {
            const ev = new KeyboardEvent('keydown', {
              key: 'F2',
              bubbles: true,
              cancelable: true
            });
            containerEl && containerEl.dispatchEvent(ev);
          } catch {}
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // If some other input (likely inline editor), let it handle
        if (isActiveInput) return;
        // Only when focus is on our container or its canvas
        const canvas = containerEl?.querySelector(
          'canvas'
        ) as HTMLCanvasElement | null;
        if (
          active !== containerEl &&
          active !== canvas &&
          active !== document.body
        )
          return;
        if (printable || editKeys) {
          pendingKeyRef.current = e.key;
          // Hint Univer to open the cell editor (simulate F2)
          // Do not forward the char yet; we’ll insert when editor mounts
          try {
            // Prefer targeting canvas for F2 to ensure inline editor opens on grid
            if (canvas) {
              canvas.focus();
              const ev = new KeyboardEvent('keydown', {
                key: 'F2',
                bubbles: true,
                cancelable: true
              });
              canvas.dispatchEvent(ev);
            } else {
              const ev = new KeyboardEvent('keydown', {
                key: 'F2',
                bubbles: true,
                cancelable: true
              });
              containerEl!.dispatchEvent(ev);
            }
            e.preventDefault();
          } catch {}
        }
      };
      containerEl?.addEventListener('keydown', containerListener as any);

      // Observe for inline editor (input/textarea/contenteditable) creation and focus it
      const isToolbarDescendant = (el: HTMLElement | null) => {
        let node: HTMLElement | null = el;
        while (node && node !== document.body) {
          const role = node.getAttribute?.('role');
          const classes = (node.className || '').toString().toLowerCase();
          const dataRegion = node.getAttribute?.('data-region') || '';
          if (
            role === 'toolbar' ||
            dataRegion.toLowerCase() === 'toolbar' ||
            classes.includes('toolbar') ||
            classes.includes('menubar') ||
            classes.includes('menu') ||
            classes.includes('dropdown') ||
            classes.includes('select')
          ) {
            return true;
          }
          node = node.parentElement as HTMLElement | null;
        }
        return false;
      };
      const findFormulaInput = (): HTMLElement | null => {
        // Try common hints to detect formula bar input
        const selectors = [
          '[aria-label*="formula" i]',
          '[data-region*="formula" i]',
          '.formula',
          '.univer-formula',
          '.univer-formula-editor'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el) return el;
        }
        return null;
      };
      const tryFindEditor = (): HTMLElement | null => {
        if (!containerEl) return null;
        // Local geometry helper to avoid referencing out-of-scope variables
        const inGrid = (el: HTMLElement | null) => {
          if (!el || !containerEl) return false;
          const crect = containerEl.getBoundingClientRect?.();
          const rect = el.getBoundingClientRect?.();
          if (!crect || !rect) return false;
          const toolbarThreshold = crect.top + 80;
          return rect.top > toolbarThreshold;
        };
        // Prefer inline contenteditable editor in grid area
        const ceCandidates = Array.from(
          document.querySelectorAll(
            '[contenteditable="true"], [role="textbox"]'
          )
        ) as HTMLElement[];
        for (const el of ceCandidates) {
          if (isToolbarDescendant(el)) continue;
          if (!(containerEl.contains(el) || document.body.contains(el)))
            continue;
          if (!inGrid(el)) continue;
          return el;
        }
        // Fallback: input/textarea inside grid area
        const inputCandidates = Array.from(
          document.querySelectorAll('input[type="text"], textarea')
        ) as HTMLElement[];
        for (const el of inputCandidates) {
          if (isToolbarDescendant(el)) continue;
          if (!(containerEl.contains(el) || document.body.contains(el)))
            continue;
          if (!inGrid(el)) continue;
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          const name = (el.getAttribute('name') || '').toLowerCase();
          if (
            aria.includes('font') ||
            aria.includes('size') ||
            name.includes('font')
          )
            continue;
          return el;
        }
        // Last resort: formula input if available
        const formulaEl = findFormulaInput();
        if (formulaEl && !isToolbarDescendant(formulaEl)) return formulaEl;
        return null;
      };
      // Global capture: if a Univer toolbar input has focus, reroute printable keys into the cell editor
      const rerouteFromToolbar = (e: KeyboardEvent) => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) return;
        const printable =
          e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        const editKeys = e.key === 'Backspace' || e.key === 'Delete';
        const isCanvasOrBody =
          active === document.body || active.tagName === 'CANVAS';
        // Case 1: Any toolbar element has focus (input/combobox/button etc.) → reroute
        if (isToolbarDescendant(active) && (printable || editKeys)) {
          pendingKeyRef.current = e.key;
          try {
            active.blur();
          } catch {}
          // Always activate grid inline editor first via canvas
          const canvas = containerEl?.querySelector(
            'canvas'
          ) as HTMLCanvasElement | null;
          try {
            (canvas || containerEl)?.focus();
          } catch {}
          try {
            const ev = new KeyboardEvent('keydown', {
              key: 'F2',
              bubbles: true,
              cancelable: true
            });
            (canvas || containerEl)?.dispatchEvent(ev);
          } catch {}
          setTimeout(() => {
            const formula = findFormulaInput();
            if (formula) {
              try {
                (formula as HTMLElement).focus();
              } catch {}
              // Seeding will be handled by MutationObserver/tryFindEditor using pendingKeyRef
            }
          }, 0);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // Case 2: Focus on canvas/body and user types a printable key → open editor
        if (isCanvasOrBody && (printable || editKeys)) {
          pendingKeyRef.current = e.key;
          const canvas = containerEl?.querySelector(
            'canvas'
          ) as HTMLCanvasElement | null;
          try {
            (canvas || containerEl)?.focus();
          } catch {}
          try {
            const ev = new KeyboardEvent('keydown', {
              key: 'F2',
              bubbles: true,
              cancelable: true
            });
            (canvas || containerEl)?.dispatchEvent(ev);
          } catch {}
          e.preventDefault();
          e.stopPropagation();
        }
      };
      window.addEventListener('keydown', rerouteFromToolbar, { capture: true });
      const focusAndSeed = (el: HTMLElement) => {
        try {
          el.focus();
        } catch {}
        const key = pendingKeyRef.current;
        if (!key) return;
        pendingKeyRef.current = null;
        // Insert initial character
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          const anyEl = el as HTMLInputElement | HTMLTextAreaElement;
          const prev = anyEl.value ?? '';
          anyEl.value = prev + key;
          anyEl.dispatchEvent(new Event('input', { bubbles: true }));
        } else if ((el as any).isContentEditable) {
          // execCommand is deprecated but still widely supported for simple text insertion
          try {
            document.execCommand('insertText', false, key);
          } catch {
            // fallback: append a text node
            try {
              el.appendChild(document.createTextNode(key));
            } catch {}
          }
        }
      };
      // Initial check (in case editor is already present due to double-click)
      const existing = tryFindEditor();
      if (existing) focusAndSeed(existing);
      const mo = new MutationObserver(() => {
        const el = tryFindEditor();
        if (el) focusAndSeed(el);
      });
      try {
        // Observe both container and document.body (Univer might render editor at top-level)
        if (containerEl)
          mo.observe(containerEl, { childList: true, subtree: true });
        if (document && document.body)
          mo.observe(document.body, { childList: true, subtree: true });
      } catch {}

      return () => {
        clearTimeout(timer);
        (univer as any).off?.('render:changed', schedule);
        try {
          window.removeEventListener('keydown', winCap, {
            capture: true
          } as any);
          window.removeEventListener('keydown', winBub);
          document.removeEventListener('keydown', docCap, {
            capture: true
          } as any);
          document.removeEventListener('keydown', docBub);
          window.removeEventListener('keydown', rerouteFromToolbar, {
            capture: true
          } as any);
          containerEl?.removeEventListener('keydown', containerListener as any);
          mo.disconnect();
        } catch {}
        univer.dispose && univer.dispose();
      };
    })();
    return () => {
      disposed = true;
    };
  }, [sheetId]);

  return (
    // Use overflow-visible so Univer popovers/menus and the inline editor aren't clipped by the wrapper
    <div className='bg-background relative z-50 overflow-visible rounded border'>
      {loading && (
        <div className='text-muted-foreground p-2 text-xs'>Loading editor…</div>
      )}
      {/* Make the editor container focusable so keyboard input works reliably */}
      <div ref={containerRef} className='w-full outline-none' tabIndex={0} />
      {mounted && debugEnabled && (
        <div className='absolute top-2 right-2 z-[9999] rounded bg-black/70 px-2 py-1 text-[11px] text-white shadow'>
          <div>Cells Debug</div>
          <div>Key: {debugInfo?.lastKey ?? '-'}</div>
          <div>From: {debugInfo?.from ?? '-'}</div>
          <div>
            Active: {debugInfo?.activeTag ?? '-'}{' '}
            {debugInfo?.activeClasses
              ? `.${String(debugInfo.activeClasses).split(' ').slice(0, 2).join('.')}`
              : ''}
          </div>
          <div>Target: {debugInfo?.targetTag ?? '-'}</div>
          <div>
            DefaultPrevented: {String(debugInfo?.defaultPrevented ?? false)}
          </div>
          <div className='opacity-60'>Add ?cellsDebug=1 to URL</div>
        </div>
      )}
    </div>
  );
}
