'use client';
import { useEffect, useRef, useState } from 'react';
import { Univer, Workbook } from '@univerjs/core';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverEngineRender } from '@univerjs/engine-render';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';

function defaultWorkbook(): any {
  return {
    id: 'wb-1',
    name: 'Workbook',
    appVersion: '0.10.10',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet 1',
        cellData: {},
        rowCount: 200,
        columnCount: 50
      }
    ],
    locale: 'enUS'
  };
}

export default function UniverSheet({ sheetId }: { sheetId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const univerRef = useRef<Univer | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let disposed = false;
    (async () => {
      setLoading(true);
      // Load existing sheet_data
      const res = await fetch(`/api/noblesuite/cells/sheets/${sheetId}/data`, {
        cache: 'no-store'
      });
      const json = await res.json();
      const data =
        json?.item?.sheet_data && Object.keys(json.item.sheet_data).length > 0
          ? json.item.sheet_data
          : defaultWorkbook();

      if (disposed || !containerRef.current) return;
      const univer = new Univer({
        locale: 'enUS',
        theme: {}
      });
      univerRef.current = univer;
      univer.registerPlugin(UniverUIPlugin);
      univer.registerPlugin(UniverEngineRender);
      univer.registerPlugin(UniverSheetsPlugin);
      univer.registerPlugin(UniverSheetsUIPlugin);
      // Create or load workbook
      univer.createUnit(Workbook, data);
      // Attach UI into container
      const root = containerRef.current;
      if (root) {
        // sheets-ui mounts into the document; container can be used for sizing
        root.style.minHeight = '60vh';
      }
      setLoading(false);

      // Auto-save debounced
      let timer: any = null;
      const save = async () => {
        if (!univerRef.current) return;
        // In Univer 0.10, get snapshot via toJson on Workbook unit
        const units = (univerRef.current as any)._unitManager?._units || [];
        const wb = units.find((u: any) => u?.unitType === 1); // 1: Workbook
        const snapshot = wb?.toJson ? wb.toJson() : data;
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

      return () => {
        clearTimeout(timer);
        (univer as any).off?.('render:changed', schedule);
        univer.dispose && univer.dispose();
      };
    })();
    return () => {
      disposed = true;
    };
  }, [sheetId]);

  return (
    <div className='overflow-hidden rounded border'>
      {loading && (
        <div className='text-muted-foreground p-2 text-xs'>Loading editor…</div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
