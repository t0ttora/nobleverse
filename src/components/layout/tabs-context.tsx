'use client';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { Icons, type Icon } from '@/components/icons';
import { supabase } from '@/lib/supabaseClient';

export type AppTab = {
  id: string;
  kind: 'cells' | 'docs' | string;
  title: string;
  icon?: Icon;
  iconName?: 'sheet' | 'doc' | 'file';
  pinned?: boolean;
};

type TabsContextValue = {
  tabs: AppTab[];
  activeTabId: string | null;
  rightActiveTabId: string | null;
  openTab: (tab: Omit<AppTab, 'id'> & { id?: string }) => string; // returns id
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  activateRightTab: (id: string | null) => void;
  activateNone: () => void; // go Home (no active tab)
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  togglePin: (id: string) => void;
  reorderTab: (dragId: string, targetId: string) => void;
  // collapse modes for tabs display
  collapseMode: 'none' | 'others' | 'bar';
  collapseBar: () => void; // whole bar collapses to single icon trigger
  collapseNone: () => void; // expand all
  collapseOthers: () => void; // only active expanded
  // split view
  split: boolean;
  splitRatio: number; // 0.2 - 0.8
  setSplit: (v: boolean) => void;
  setSplitRatio: (r: number) => void;
  // which pane is focused for tab highlighting
  focusedPane: 'left' | 'right';
  setFocusedPane: (p: 'left' | 'right') => void;
  // future: pin/unpin, move, split
};

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [rightActiveTabId, setRightActiveTabId] = useState<string | null>(null);
  const [split, _setSplit] = useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [collapseMode, setCollapseMode] = useState<'none' | 'others' | 'bar'>(
    'none'
  );
  const [focusedPane, setFocusedPane] = useState<'left' | 'right'>('left');

  // Load persisted tabs from profiles.ui_tabs
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/tabs', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const payload = json?.ui_tabs as {
          tabs?: AppTab[];
          active?: string | null;
          rightActive?: string | null;
          split?: boolean;
          splitRatio?: number;
          collapseMode?: 'none' | 'others' | 'bar';
        } | null;
        if (payload && Array.isArray(payload.tabs)) {
          // Resolve icons from iconName
          const resolved = payload.tabs.map((t) => ({
            ...t,
            icon:
              t.iconName === 'sheet'
                ? (Icons.sheet as unknown as Icon)
                : t.iconName === 'doc'
                  ? (Icons.doc as unknown as Icon)
                  : t.icon || (Icons.file as unknown as Icon)
          }));
          setTabs(resolved);
          setActiveTabId(payload.active ?? (payload.tabs[0]?.id || null));
          setRightActiveTabId(payload.rightActive ?? null);
          if (typeof payload.split === 'boolean') _setSplit(payload.split);
          if (typeof payload.splitRatio === 'number')
            setSplitRatio(
              Math.min(0.8, Math.max(0.2, Number(payload.splitRatio) || 0.5))
            );
          if (payload.collapseMode) setCollapseMode(payload.collapseMode);
        }
      } catch {}
    }
    void load();

    // Realtime listen cross-device on profiles updates for ui_tabs
    let channel: any;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        channel = supabase
          .channel('tabs-profiles')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${uid}`
            },
            (payload) => {
              const ui_tabs = (payload.new as any)?.ui_tabs;
              if (ui_tabs && Array.isArray(ui_tabs.tabs)) {
                setTabs(ui_tabs.tabs);
                setActiveTabId(ui_tabs.active ?? (ui_tabs.tabs[0]?.id || null));
                setRightActiveTabId(ui_tabs.rightActive ?? null);
                if (typeof ui_tabs.split === 'boolean')
                  _setSplit(ui_tabs.split);
                if (typeof ui_tabs.splitRatio === 'number')
                  setSplitRatio(
                    Math.min(
                      0.8,
                      Math.max(0.2, Number(ui_tabs.splitRatio) || 0.5)
                    )
                  );
                if (ui_tabs.collapseMode) setCollapseMode(ui_tabs.collapseMode);
              }
            }
          )
          .subscribe();
      } catch {}
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Persist on change (debounced slightly via microtask)
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        // Serialize with iconName
        const serializable = tabs.map((t) => ({
          ...t,
          icon: undefined,
          iconName:
            t.iconName ||
            (t.kind === 'cells' ? 'sheet' : t.kind === 'docs' ? 'doc' : 'file')
        }));
        await fetch('/api/tabs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ui_tabs: {
              tabs: serializable,
              active: activeTabId,
              rightActive: rightActiveTabId,
              split,
              splitRatio,
              collapseMode
            }
          }),
          signal: controller.signal
        });
      } catch {}
    }, 80);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    JSON.stringify(tabs),
    activeTabId,
    rightActiveTabId,
    split,
    splitRatio,
    collapseMode
  ]);

  const openTab = useCallback((tab: Omit<AppTab, 'id'> & { id?: string }) => {
    const id =
      tab.id ||
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setTabs((prev) => {
      // if tab with same id exists, just activate
      const exists = prev.some((t) => t.id === id);
      if (exists) return prev;
      // auto-number untitled cells/docs
      let title = tab.title;
      const baseTitle =
        tab.kind === 'cells'
          ? 'Untitled Cells'
          : tab.kind === 'docs'
            ? 'Untitled Doc'
            : null;
      if (baseTitle && title === baseTitle) {
        // collect existing numbers for same base (unnumbered counts as 0)
        const nums = prev
          .filter(
            (t) =>
              t.kind === tab.kind &&
              (t.title === baseTitle || t.title.startsWith(baseTitle + ' '))
          )
          .map((t) => {
            const m = t.title.match(/^(.*?)(\s+(\d+))$/);
            const n = m ? Number(m[3]) : t.title === baseTitle ? 0 : 0;
            return Number.isFinite(n) ? n : 0;
          });
        if (nums.length === 0) {
          // first one stays as baseTitle (implicit 0, not shown)
        } else {
          const nextNum = Math.max(...nums) + 1;
          title = `${baseTitle} ${nextNum}`;
        }
      }
      // insert just before end to keep order; new tabs at end by default
      return [
        ...prev,
        {
          id,
          kind: tab.kind,
          title,
          icon: tab.icon,
          pinned: tab.pinned
        }
      ];
    });
    setActiveTabId(id);
    return id;
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      // if closing active, select previous index or last
      setActiveTabId((prevActive) => {
        if (prevActive !== id) return prevActive;
        if (next.length === 0) return null;
        const fallback =
          next[Math.min(Math.max(0, idx - 1), next.length - 1)]?.id;
        return fallback || next.at(-1)?.id || null;
      });
      // if closing right active, fallback to left active or neighbor
      setRightActiveTabId((prevRight) => {
        if (prevRight !== id) return prevRight;
        // prefer the (new) active left tab
        if (next.length === 0) return null;
        const newLeft =
          next[Math.min(Math.max(0, idx - 1), next.length - 1)]?.id ||
          next.at(-1)?.id ||
          null;
        return newLeft;
      });
      return next;
    });
  }, []);

  const activateTab = useCallback((id: string) => {
    setActiveTabId(id);
    setFocusedPane('left');
  }, []);

  const activateRightTab = useCallback((id: string | null) => {
    setRightActiveTabId(id);
    if (id) setFocusedPane('right');
  }, []);

  const activateNone = useCallback(() => {
    setActiveTabId(null);
  }, []);

  const pinTab = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, pinned: true } : t))
    );
  }, []);
  const unpinTab = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, pinned: false } : t))
    );
  }, []);
  const togglePin = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t))
    );
  }, []);

  // Reorder within same group (pinned vs regular). Move dragId before targetId
  const reorderTab = useCallback((dragId: string, targetId: string) => {
    setTabs((prev) => {
      if (dragId === targetId) return prev;
      const dragIdx = prev.findIndex((t) => t.id === dragId);
      const targetIdx = prev.findIndex((t) => t.id === targetId);
      if (dragIdx === -1 || targetIdx === -1) return prev;
      const drag = prev[dragIdx];
      const target = prev[targetIdx];
      // Only reorder if both are in the same pinned group
      if (!!drag.pinned !== !!target.pinned) return prev;
      const arr = prev.slice();
      // remove drag
      arr.splice(dragIdx, 1);
      // recompute target index after removal
      const newTargetIdx = arr.findIndex((t) => t.id === targetId);
      arr.splice(newTargetIdx, 0, drag);
      return arr;
    });
  }, []);

  const collapseBar = useCallback(() => setCollapseMode('bar'), []);
  const collapseNone = useCallback(() => setCollapseMode('none'), []);
  const collapseOthers = useCallback(() => setCollapseMode('others'), []);

  const value = useMemo<TabsContextValue>(
    () => ({
      tabs,
      activeTabId,
      rightActiveTabId,
      openTab,
      closeTab,
      activateTab,
      activateRightTab,
      activateNone,
      pinTab,
      unpinTab,
      togglePin,
      reorderTab,
      collapseMode,
      collapseBar,
      collapseNone,
      collapseOthers,
      split,
      splitRatio,
      setSplit: (v: boolean) => {
        _setSplit(v);
        if (v) {
          // If Home (no active left tab), default to 60/40 split
          if (!activeTabId) setSplitRatio(0.6);
          // choose a default right tab different than left if possible
          if (!rightActiveTabId) {
            const right = tabs.find((t) => t.id !== activeTabId)?.id || null;
            setRightActiveTabId(right);
          }
          setFocusedPane('left');
        }
      },
      setSplitRatio,
      focusedPane,
      setFocusedPane
    }),
    [
      tabs,
      activeTabId,
      rightActiveTabId,
      openTab,
      closeTab,
      activateTab,
      activateRightTab,
      activateNone,
      pinTab,
      unpinTab,
      togglePin,
      reorderTab,
      collapseMode,
      collapseBar,
      collapseNone,
      collapseOthers,
      split,
      splitRatio,
      focusedPane
    ]
  );

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('useTabs must be used within TabsProvider');
  return ctx;
}
