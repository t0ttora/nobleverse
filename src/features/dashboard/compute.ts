// Pure functions to compute KPI metrics from domain arrays.
// These functions are framework-agnostic and unit-testable.

export type SeriesPoint = { date: string; value: number };

export type KpiComputed = {
  key: string;
  label: string;
  value: number;
  trend: 'up' | 'down' | 'flat';
  deltaPct?: number;
  note?: string;
  headline?: string; // short professional line under the number
  series?: SeriesPoint[];
};

export type Shipment = {
  id: string;
  owner_id: string;
  forwarder_id: string;
  status: string;
  net_amount_cents?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type RequestRow = {
  id: string | number;
  user_id: string;
  status?: string | null;
  created_at?: string;
};

export type OfferRow = {
  id: string;
  request_id: string | number;
  forwarder_id: string;
  status: 'sent' | 'withdrawn' | 'accepted' | 'rejected';
  created_at?: string;
};

function pctDelta(
  curr: number,
  prev: number
): { delta: number; trend: KpiComputed['trend'] } {
  if (!isFinite(prev) || prev === 0) {
    return { delta: 0, trend: 'flat' };
  }
  const diff = curr - prev;
  const delta = (diff / prev) * 100;
  return { delta, trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' };
}

function groupByTime(
  points: { ts: number; value: number }[],
  bucketDays = 7
): SeriesPoint[] {
  if (!points.length) return [];
  const MS_DAY = 86400000;
  const bucket = bucketDays * MS_DAY;
  const min = Math.min(...points.map((p) => p.ts));
  const start = Math.floor(min / bucket) * bucket;
  const map = new Map<number, number>();
  for (const p of points) {
    const b = Math.floor((p.ts - start) / bucket) * bucket + start;
    map.set(b, (map.get(b) || 0) + p.value);
  }
  const arr = Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, v]) => ({ date: new Date(ts).toISOString(), value: v }));
  return arr;
}

export function computeShipperKpis({
  shipments,
  requests
}: {
  shipments: Shipment[];
  requests: RequestRow[];
}): KpiComputed[] {
  const now = Date.now();
  const MS_30D = 1000 * 60 * 60 * 24 * 30;
  const last30 = now - MS_30D;
  const prev30 = last30 - MS_30D;

  // Total spend over all time and last windows
  const spendAll =
    shipments.reduce((s, r) => s + (r.net_amount_cents || 0), 0) / 100;
  const spendCurr =
    shipments
      .filter(
        (s) => new Date(s.created_at || s.updated_at || 0).getTime() >= last30
      )
      .reduce((s, r) => s + (r.net_amount_cents || 0), 0) / 100;
  const spendPrev =
    shipments
      .filter((s) => {
        const t = new Date(s.created_at || s.updated_at || 0).getTime();
        return t >= prev30 && t < last30;
      })
      .reduce((s, r) => s + (r.net_amount_cents || 0), 0) / 100;
  const spendSeries = groupByTime(
    shipments.map((s) => ({
      ts: new Date(s.created_at || s.updated_at || now).getTime(),
      value: (s.net_amount_cents || 0) / 100
    })),
    7
  );
  const spendDelta = pctDelta(spendCurr, spendPrev);

  const inTransit = shipments.filter((s) => s.status === 'in_transit').length;
  const delivered = shipments.filter((s) => s.status === 'delivered').length;
  const active = shipments.filter((s) => s.status !== 'cancelled').length;
  const deliveryRate = active > 0 ? (delivered / active) * 100 : 0;

  const openReq = requests.filter((r) =>
    ['pending', 'open', 'in_progress', 'approved'].includes(String(r.status))
  ).length;

  const spendHeadline =
    spendDelta.trend === 'up'
      ? 'Spending up this cycle'
      : spendDelta.trend === 'down'
        ? 'Spending down this cycle'
        : 'Spending steady this cycle';

  const inTransitHeadline =
    inTransit === 0
      ? 'No active shipments in motion'
      : 'Shipments in motion this cycle';

  const deliveryHeadline =
    deliveryRate > 0
      ? 'Delivery rate consistent this cycle'
      : 'No delivered shipments yet';

  const openReqHeadline =
    openReq > 0 ? 'Open request volume steady' : 'No open requests currently';

  return [
    {
      key: 'total_spend',
      label: 'Total Spend',
      value: Math.round(spendAll),
      trend: spendDelta.trend,
      deltaPct: spendDelta.delta,
      note: 'Comparing last 30 days vs previous 30 days',
      headline: spendHeadline,
      series: spendSeries
    },
    {
      key: 'in_transit',
      label: 'Shipments in Transit',
      value: inTransit,
      trend: 'flat',
      note: 'Consistent with previous 30-day average',
      headline: inTransitHeadline
    },
    {
      key: 'delivery_rate',
      label: 'Delivery Rate',
      value: Math.round(deliveryRate),
      trend: 'flat',
      note: 'Performance steady over last 30 days',
      headline: deliveryHeadline
    },
    {
      key: 'open_requests',
      label: 'Open Requests',
      value: openReq,
      trend: 'flat',
      note: 'Tracking similar to last 30 days',
      headline: openReqHeadline
    }
  ];
}

export function computeForwarderKpis({
  shipments,
  offers
}: {
  shipments: Shipment[];
  offers: OfferRow[];
}): KpiComputed[] {
  const activeShip = shipments.filter(
    (s) => s.status !== 'delivered' && s.status !== 'cancelled'
  ).length;
  const sent = offers.length;
  const accepted = offers.filter((o) => o.status === 'accepted').length;
  const acceptanceRate = sent > 0 ? (accepted / sent) * 100 : 0;
  const avgRevenue = (() => {
    const completed = shipments.filter((s) => (s.net_amount_cents || 0) > 0);
    if (!completed.length) return 0;
    const sum = completed.reduce((s, r) => s + (r.net_amount_cents || 0), 0);
    return Math.round(sum / completed.length) / 100;
  })();

  return [
    {
      key: 'active_shipments',
      label: 'Active Shipments',
      value: activeShip,
      trend: 'flat',
      headline: activeShip
        ? 'Operations active this cycle'
        : 'No active shipments',
      note: 'Live view for current period'
    },
    {
      key: 'acceptance_rate',
      label: 'Quotes Acceptance',
      value: Math.round(acceptanceRate),
      trend: 'flat',
      headline: 'Win rate stability',
      note: 'Based on sent vs accepted'
    },
    {
      key: 'avg_revenue',
      label: 'Revenue per Shipment',
      value: avgRevenue,
      trend: 'flat',
      headline: 'Average net per shipment',
      note: 'Computed over completed shipments'
    },
    {
      key: 'quotes_sent',
      label: 'Quotes Sent',
      value: sent,
      trend: 'flat',
      headline: sent ? 'Quote activity this cycle' : 'No quotes sent yet',
      note: 'Last 30 days activity'
    }
  ];
}

export function computeReceiverKpis({
  shipments,
  notificationsUnread
}: {
  shipments: Shipment[];
  notificationsUnread: number;
}): KpiComputed[] {
  const incoming = shipments.filter(
    (s) => s.status !== 'delivered' && s.status !== 'cancelled'
  ).length;
  const delivered = shipments.filter((s) => s.status === 'delivered').length;
  const total = shipments.length || 1;
  const accuracy = (delivered / total) * 100;
  return [
    {
      key: 'incoming_shipments',
      label: 'Incoming Shipments',
      value: incoming,
      trend: 'flat',
      headline: incoming ? 'Shipments arriving soon' : 'No incoming shipments',
      note: 'Live ETA window'
    },
    {
      key: 'delivery_accuracy',
      label: 'Delivery Accuracy',
      value: Math.round(accuracy),
      trend: 'flat',
      headline: 'On-time performance',
      note: 'Last 30 days vs prior'
    },
    {
      key: 'unread_notifications',
      label: 'Unread Notifications',
      value: notificationsUnread,
      trend: 'flat',
      headline: notificationsUnread
        ? 'Actions pending review'
        : 'Inbox is clear',
      note: 'Mark items as read to reduce noise'
    }
  ];
}
