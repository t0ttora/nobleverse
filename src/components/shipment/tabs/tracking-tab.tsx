'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

type Source = {
  id: string;
  mode: 'road' | 'air' | 'sea';
  source_type: string;
  identifier: string | null;
  provider: string | null;
  meta: any;
  active: boolean;
  created_at: string;
};

export function TrackingTab({ shipmentId }: { shipmentId: string }) {
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [status, setStatus] = useState<any>(null);

  const fetchSources = useCallback(async () => {
    const res = await fetch(`/api/shipments/${shipmentId}/tracking/sources`);
    if (!res.ok) return;
    const json = await res.json();
    setSources(json.sources || []);
  }, [shipmentId]);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/shipments/${shipmentId}/tracking/status`);
    if (!res.ok) return;
    const json = await res.json();
    setStatus(json.status || null);
  }, [shipmentId]);

  useEffect(() => {
    fetchSources();
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchSources, fetchStatus]);

  const driverSource = useMemo(
    () =>
      sources.find((s) => s.mode === 'road' && s.source_type === 'driver_app'),
    [sources]
  );

  const onCreateDriverSource = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/tracking/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'road',
          source_type: 'driver_app',
          meta: {}
        })
      });
      if (res.ok) {
        await fetchSources();
      }
    } finally {
      setLoading(false);
    }
  }, [shipmentId, fetchSources]);

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-base font-semibold'>Tracking</h3>
        {!driverSource ? (
          <Button onClick={onCreateDriverSource} disabled={loading}>
            {loading ? 'Creating…' : 'Enable Driver GPS'}
          </Button>
        ) : null}
      </div>

      {driverSource ? (
        <Card className='p-4'>
          <div className='space-y-2'>
            <div className='text-muted-foreground text-sm'>
              Driver App Token
            </div>
            <Input readOnly value={driverSource.meta?.token ?? ''} />
            <div className='text-muted-foreground text-xs'>
              Share this token with your driver app. It will POST lat/lon to
              /api/tracking/ingest.
            </div>
          </div>
        </Card>
      ) : null}

      <Card className='p-4'>
        <div className='space-y-2'>
          <div className='text-sm font-medium'>Last known position</div>
          {status ? (
            <div className='text-sm'>
              {status.last_lat}, {status.last_lon} at{' '}
              {new Date(status.last_timestamp).toLocaleString()} (
              {status.provider})
            </div>
          ) : (
            <div className='text-muted-foreground text-sm'>No position yet</div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default TrackingTab;
