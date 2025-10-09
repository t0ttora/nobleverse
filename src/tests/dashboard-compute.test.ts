import { describe, it, expect } from 'vitest';
import {
  computeShipperKpis,
  computeForwarderKpis,
  computeReceiverKpis
} from '@/features/dashboard/compute';

describe('dashboard compute', () => {
  it('computes shipper KPIs with empty arrays', () => {
    const k = computeShipperKpis({ shipments: [], requests: [] });
    const byKey = Object.fromEntries(k.map((x) => [x.key, x]));
    expect(byKey.total_spend.value).toBe(0);
    expect(byKey.in_transit.value).toBe(0);
    expect(byKey.delivery_rate.value).toBe(0);
    expect(byKey.open_requests.value).toBe(0);
  });

  it('computes forwarder KPIs basic', () => {
    const k = computeForwarderKpis({
      shipments: [
        {
          id: '1',
          owner_id: 'a',
          forwarder_id: 'f',
          status: 'delivered',
          net_amount_cents: 10000
        },
        {
          id: '2',
          owner_id: 'a',
          forwarder_id: 'f',
          status: 'in_transit',
          net_amount_cents: 20000
        }
      ],
      offers: [
        { id: 'o1', request_id: 'r1', forwarder_id: 'f', status: 'accepted' },
        { id: 'o2', request_id: 'r2', forwarder_id: 'f', status: 'sent' }
      ]
    } as any);
    const byKey = Object.fromEntries(k.map((x) => [x.key, x]));
    expect(byKey.active_shipments.value).toBe(1); // in_transit only
    expect(byKey.quotes_sent.value).toBe(2);
    expect(byKey.acceptance_rate.value).toBeCloseTo(50, 1);
    expect(byKey.avg_revenue.value).toBe(150); // average of 100 and 200 in dollars
  });

  it('computes receiver KPIs', () => {
    const k = computeReceiverKpis({
      shipments: [
        { id: '1', owner_id: 'a', forwarder_id: 'f', status: 'delivered' },
        { id: '2', owner_id: 'a', forwarder_id: 'f', status: 'in_transit' }
      ] as any,
      notificationsUnread: 3
    });
    const byKey = Object.fromEntries(k.map((x) => [x.key, x]));
    expect(byKey.incoming_shipments.value).toBe(1);
    expect(byKey.delivery_accuracy.value).toBeCloseTo(50, 1);
    expect(byKey.unread_notifications.value).toBe(3);
  });
});
