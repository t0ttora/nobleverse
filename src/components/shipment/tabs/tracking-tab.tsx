'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';

function useRealtimeStatus(shipmentId: string, onUpdate: (s: any) => void) {
  useEffect(() => {
    const ch = supabase
      .channel(`realtime:tracking_status:${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracking_status',
          filter: `shipment_id=eq.${shipmentId}`
        },
        (payload) => {
          if (
            payload.eventType === 'INSERT' ||
            payload.eventType === 'UPDATE'
          ) {
            onUpdate(payload.new);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [shipmentId, onUpdate]);
}

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
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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

  useRealtimeStatus(
    shipmentId,
    useCallback((s) => setStatus(s), [])
  );

  const driverSource = useMemo(
    () =>
      sources.find((s) => s.mode === 'road' && s.source_type === 'driver_app'),
    [sources]
  );

  const onCreateAirAwb = useCallback(async () => {
    setLoading(true);
    try {
      const awb = prompt('Enter AWB (e.g., TK123-4567890)');
      if (!awb) return;
      const res = await fetch(`/api/shipments/${shipmentId}/tracking/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'air',
          source_type: 'air_awb',
          identifier: awb
        })
      });
      if (res.ok) await fetchSources();
    } finally {
      setLoading(false);
    }
  }, [shipmentId, fetchSources]);

  const onCreateSeaContainer = useCallback(async () => {
    setLoading(true);
    try {
      const container = prompt('Enter Container Number (e.g., MSKU1234567)');
      if (!container) return;
      const res = await fetch(`/api/shipments/${shipmentId}/tracking/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sea',
          source_type: 'container',
          identifier: container
        })
      });
      if (res.ok) await fetchSources();
    } finally {
      setLoading(false);
    }
  }, [shipmentId, fetchSources]);

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

  const onRotateToken = useCallback(async () => {
    if (!driverSource) return;
    await fetch(
      `/api/shipments/${shipmentId}/tracking/sources/${driverSource.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rotate_token' })
      }
    );
    await fetchSources();
  }, [driverSource, shipmentId, fetchSources]);

  const onToggleActive = useCallback(async () => {
    if (!driverSource) return;
    const action = driverSource.active ? 'deactivate' : 'activate';
    await fetch(
      `/api/shipments/${shipmentId}/tracking/sources/${driverSource.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      }
    );
    await fetchSources();
  }, [driverSource, shipmentId, fetchSources]);

  const onTestPing = useCallback(async () => {
    if (!driverSource?.meta?.token) return;
    let lat = 41.015137;
    let lon = 28.97953;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation?.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 2000
        })
      );
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {}
    await fetch('/api/tracking/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: driverSource.meta.token,
        shipment_id: shipmentId,
        lat,
        lon
      })
    });
  }, [driverSource, shipmentId]);

  const airSeaSources = useMemo(
    () => sources.filter((s) => s.mode === 'air' || s.mode === 'sea'),
    [sources]
  );

  const onUpdateSource = useCallback(
    async (
      sourceId: string,
      updates: { provider?: string; identifier?: string }
    ) => {
      setActionMsg(null);
      const res = await fetch(
        `/api/shipments/${shipmentId}/tracking/sources/${sourceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', ...updates })
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setActionMsg(j.error || 'Update failed');
        return;
      }
      await fetchSources();
      setActionMsg('Saved');
      setTimeout(() => setActionMsg(null), 1500);
    },
    [shipmentId, fetchSources]
  );

  const onRefreshSource = useCallback(
    async (sourceId: string) => {
      setActionMsg(null);
      const res = await fetch(
        `/api/shipments/${shipmentId}/tracking/sources/${sourceId}/refresh`,
        {
          method: 'POST'
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setActionMsg(j.error || 'Refresh failed');
        return;
      }
      setActionMsg('Refreshed');
      setTimeout(() => setActionMsg(null), 1500);
    },
    [shipmentId]
  );

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
        <h3 className='text-base font-semibold'>Tracking</h3>
        <div className='flex gap-2'>
          {!driverSource && (
            <Button onClick={onCreateDriverSource} disabled={loading}>
              {loading ? 'Creating…' : 'Enable Driver GPS'}
            </Button>
          )}
          <Button
            variant='secondary'
            onClick={onCreateAirAwb}
            disabled={loading}
          >
            Add Air (AWB)
          </Button>
          <Button
            variant='secondary'
            onClick={onCreateSeaContainer}
            disabled={loading}
          >
            Add Sea (Container)
          </Button>
        </div>
      </div>

      {driverSource ? (
        <Card className='p-4'>
          <div className='grid gap-3 md:grid-cols-3'>
            <div className='space-y-2 md:col-span-2'>
              <div className='text-muted-foreground text-sm'>
                Driver App Token
              </div>
              <div className='flex items-center gap-2'>
                <Input readOnly value={driverSource.meta?.token ?? ''} />
                <Button size='sm' variant='outline' onClick={onRotateToken}>
                  Rotate
                </Button>
                <Button
                  size='sm'
                  variant={driverSource.active ? 'destructive' : 'secondary'}
                  onClick={onToggleActive}
                >
                  {driverSource.active ? 'Disable' : 'Enable'}
                </Button>
                <Button size='sm' onClick={onTestPing}>
                  Test ping
                </Button>
              </div>
              <div className='text-muted-foreground text-xs'>
                Share this token with your driver app. It will POST lat/lon to
                /api/tracking/ingest.
              </div>
            </div>
            <div className='flex items-center justify-center'>
              {/* Light inline QR via URL schema; driver app can scan 'nobleverse://track?token=...&shipment=...' */}
              <img
                alt='Driver token QR'
                className='h-28 w-28 rounded bg-white p-1 shadow'
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`nobleverse://track?token=${driverSource.meta?.token || ''}&shipment=${shipmentId}`)}`}
              />
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

      {airSeaSources.length > 0 && (
        <Card className='p-4'>
          <div className='mb-2 flex items-center justify-between'>
            <div className='text-sm font-medium'>Air/Sea Sources</div>
            {actionMsg && (
              <div className='text-muted-foreground text-xs'>{actionMsg}</div>
            )}
          </div>
          <div className='space-y-4'>
            {airSeaSources.map((s) => (
              <SourceRow
                key={s.id}
                source={s}
                onSave={(u) => onUpdateSource(s.id, u)}
                onRefresh={() => onRefreshSource(s.id)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default TrackingTab;

function SourceRow({
  source,
  onSave,
  onRefresh
}: {
  source: Source;
  onSave: (updates: {
    provider?: string;
    identifier?: string;
  }) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}) {
  const [provider, setProvider] = useState<string>(source.provider || '');
  const [identifier, setIdentifier] = useState<string>(source.identifier || '');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({ provider, identifier });
    } finally {
      setSaving(false);
    }
  }, [onSave, provider, identifier]);

  return (
    <div className='grid gap-2 md:grid-cols-6 md:items-end'>
      <div className='text-muted-foreground text-xs md:col-span-1'>
        <div className='font-medium capitalize'>{source.mode}</div>
        <div className='truncate'>{source.source_type}</div>
      </div>
      <div className='md:col-span-2'>
        <div className='text-muted-foreground mb-1 text-xs'>Provider</div>
        <Input
          placeholder='e.g., opensky / aerodatabox / marinetraffic'
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
      </div>
      <div className='md:col-span-2'>
        <div className='text-muted-foreground mb-1 text-xs'>Identifier</div>
        <Input
          placeholder={
            source.mode === 'air'
              ? 'AWB / Flight # (e.g., TK1234)'
              : 'Container / BL / MMSI/IMO'
          }
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </div>
      <div className='flex gap-2'>
        <Button
          size='sm'
          variant='secondary'
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size='sm' onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
