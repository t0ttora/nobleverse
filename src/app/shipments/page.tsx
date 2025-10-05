'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { createClient as createBrowserClient } from '@/lib/client';
import { ShipmentsTable } from '@/components/ui/shipments-table';
import { useRouter } from 'next/navigation';
import { RequestDetailsPanel } from '@/components/requests/request-details-panel';
import { useProfileRole } from '@/hooks/use-profile-role';
import {
  getOfferCountsByRequest,
  getOffersForForwarder
} from '@/../utils/supabase/offers';
import { useSearchParams } from 'next/navigation';
import { OfferDetailsDialog } from '@/components/offers/offer-details-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ForwarderOfferForm,
  type ForwarderOfferFormHandle
} from '@/components/offers/forwarder-offer-form';

const supabase = createBrowserClient();

const BASE_TABS = [
  { label: 'Shipments', value: 'shipments' },
  { label: 'Requests', value: 'requests' },
  { label: 'Archive', value: 'archive' }
];

export default function ShipmentsPage() {
  const [activeTab, setActiveTab] = React.useState('shipments');
  const router = useRouter();
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<any | null>(null);
  const { role } = useProfileRole();
  const [offerCounts, setOfferCounts] = React.useState<Record<string, number>>(
    {}
  );
  const [viewMode, setViewMode] = React.useState<'table' | 'grid'>('table');
  const [me, setMe] = React.useState<string>('');
  const [offersLoading, setOffersLoading] = React.useState(false);
  const [offersData, setOffersData] = React.useState<any[]>([]);
  const [hasOffersOnly, setHasOffersOnly] = React.useState<boolean>(false);
  const [hideOffered, setHideOffered] = React.useState<boolean>(true);
  const [negotiationCountsByRequest, setNegotiationCountsByRequest] =
    React.useState<Record<string, number>>({});
  // Offer preview & edit
  const [offerDialogOpen, setOfferDialogOpen] = React.useState(false);
  const [selectedOffer, setSelectedOffer] = React.useState<any | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const offerFormRef = React.useRef<ForwarderOfferFormHandle | null>(null);
  const [formState, setFormState] = React.useState<{
    isFirst: boolean;
    isLast: boolean;
    submitting: boolean;
    step: number;
    currentValid: boolean;
  }>({
    isFirst: true,
    isLast: false,
    submitting: false,
    step: 0,
    currentValid: false
  });
  // avatar stacks removed
  const searchParams = useSearchParams();

  const tabs = React.useMemo(
    () =>
      role === 'forwarder'
        ? [...BASE_TABS, { label: 'Offers', value: 'offers' }]
        : BASE_TABS,
    [role]
  );

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id || ''));
  }, []);

  // Open panel via URL param ?request=<id>
  React.useEffect(() => {
    const rid = searchParams.get('request');
    if (!rid) return;
    (async () => {
      const { data: r } = await (supabase as any)
        .from('requests')
        .select('*')
        .eq('id', rid)
        .maybeSingle();
      if (r) {
        setSelected(r);
        setPanelOpen(true);
      }
    })();
  }, [searchParams]);

  React.useEffect(() => {
    async function fetchData() {
      if (activeTab === 'offers') {
        if (!me) return;
        setOffersLoading(true);
        try {
          const list = await getOffersForForwarder(supabase as any, me);
          const ids = Array.from(
            new Set((list || []).map((o: any) => o.request_id))
          );
          if (ids.length) {
            const { data: reqs } = await (supabase as any)
              .from('requests')
              .select(
                'id, code, user_id, details, status, freight_type, created_at, updated_at'
              )
              .in('id', ids);
            // Map offers by request for quick access
            const offerMap: Record<string, any> = {};
            for (const o of list || []) offerMap[String(o.request_id)] = o;
            const uids = Array.from(
              new Set((reqs || []).map((r: any) => r.user_id).filter(Boolean))
            );
            let profMap: Record<string, any> = {};
            if (uids.length) {
              const { data: profs } = await (supabase as any)
                .from('profiles')
                .select('id, username, company_name, avatar_url')
                .in('id', uids);
              for (const p of profs || []) profMap[String(p.id)] = p;
            }
            const enriched = (reqs || []).map((r: any) => {
              const p = r.user_id ? profMap[String(r.user_id)] : null;
              const myOffer = offerMap[String(r.id)] || null;
              return {
                ...r,
                owner_company_name: p?.company_name ?? null,
                owner_username: p?.username ?? null,
                owner_avatar_url: p?.avatar_url ?? null,
                my_offer: myOffer
              };
            });
            setOffersData(enriched);
            // Fetch negotiation counts for my offers and map to request ids
            try {
              const myOfferIds = (list || []).map((o: any) => o.id);
              if (myOfferIds.length) {
                const { data: negs, error: nerr } = await (supabase as any)
                  .from('negotiations')
                  .select('offer_id')
                  .in('offer_id', myOfferIds as any);
                if (!nerr) {
                  const byOffer: Record<string, number> = {};
                  for (const n of (negs || []) as any[]) {
                    const oid = String(n.offer_id);
                    byOffer[oid] = (byOffer[oid] ?? 0) + 1;
                  }
                  const byRequest: Record<string, number> = {};
                  for (const r of enriched) {
                    const mo = r.my_offer;
                    if (mo) {
                      const c = byOffer[String(mo.id)] || 0;
                      if (c > 0) byRequest[String(r.id)] = c;
                    }
                  }
                  setNegotiationCountsByRequest(byRequest);
                } else {
                  setNegotiationCountsByRequest({});
                }
              } else {
                setNegotiationCountsByRequest({});
              }
            } catch {
              setNegotiationCountsByRequest({});
            }
            try {
              const counts = await getOfferCountsByRequest(
                supabase as any,
                ids
              );
              setOfferCounts(counts);
            } catch {
              setOfferCounts({});
            }
          } else {
            setOffersData([]);
            setOfferCounts({});
            setNegotiationCountsByRequest({});
          }
        } finally {
          setOffersLoading(false);
        }
        return;
      }

      setLoading(true);
      let table = activeTab;
      if (activeTab === 'archive') table = 'shipments_archive';
      // Map 'shipments' tab to actual shipments table
      if (table === 'shipments') table = 'shipments';
      let query = supabase.from(table).select('*');
      // Filter: Requests (shipper sees own requests). For Shipments, rely on RLS to restrict
      // visibility to participants (owner, forwarder, brokers in participants array).
      if (me && table === 'requests') {
        if (role === 'shipper') {
          query = query.eq('user_id', me);
          if (activeTab === 'requests') {
            query = query.neq('status', 'archived');
          }
        }
      }
      // Shipments: fetch rows where current user is owner, forwarder, or in participants
      if (me && (table === 'shipments' || table === 'shipments_archive')) {
        const applySearch = (q: any) =>
          search ? q.ilike('code', `%${search}%`) : q;
        const q1 = applySearch(
          (supabase as any)
            .from(table)
            .select('*')
            .or(`owner_id.eq.${me},forwarder_id.eq.${me}`)
        );
        const q2 = applySearch(
          (supabase as any)
            .from(table)
            .select('*')
            .contains('participants', [me])
        );
        const [r1, r2] = await Promise.all([q1, q2]);
        const errorShip = r1.error || r2.error;
        const map: Record<string, any> = {};
        for (const row of r1.data || []) map[String(row.id)] = row;
        for (const row of r2.data || []) map[String(row.id)] = row;
        const rowsShip: any[] = Object.values(map);
        if (!errorShip) {
          const uids = Array.from(
            new Set(
              (rowsShip || []).map((r: any) => r.owner_id).filter(Boolean)
            )
          );
          let profMap: Record<string, any> = {};
          if (uids.length) {
            const { data: profs } = await (supabase as any)
              .from('profiles')
              .select('id, username, company_name, avatar_url')
              .in('id', uids);
            for (const p of profs || []) profMap[String(p.id)] = p;
          }
          const enriched = (rowsShip || []).map((r: any) => {
            const p = r.owner_id ? profMap[String(r.owner_id)] : null;
            return {
              ...r,
              owner_company_name: p?.company_name ?? null,
              owner_username: p?.username ?? null,
              owner_avatar_url: p?.avatar_url ?? null
            };
          });
          setData(enriched);
          setOfferCounts({});
        }
        setLoading(false);
        return;
      }
      if (search) query = query.ilike('code', `%${search}%`);
      const { data: rows, error } = await query;
      if (!error) {
        // Enrich with owner profile for shipments, requester profile for requests
        const uids = Array.from(
          new Set(
            ((rows || []) as any[])
              .map((r: any) => (table === 'requests' ? r.user_id : r.owner_id))
              .filter(Boolean)
          )
        );
        let profMap: Record<string, any> = {};
        if (uids.length) {
          const { data: profs } = await (supabase as any)
            .from('profiles')
            .select('id, username, company_name, avatar_url')
            .in('id', uids);
          for (const p of profs || []) profMap[String(p.id)] = p;
        }
        const enriched = (rows || []).map((r: any) => {
          const ownerKey = table === 'requests' ? r.user_id : r.owner_id;
          const p = ownerKey ? profMap[String(ownerKey)] : null;
          return {
            ...r,
            owner_company_name: p?.company_name ?? null,
            owner_username: p?.username ?? null,
            owner_avatar_url: p?.avatar_url ?? null
          };
        });
        setData(enriched);
        // Offer counts apply only to Requests tab
        if (activeTab === 'requests') {
          try {
            const ids = enriched.map((r: any) => r.id);
            const counts = await getOfferCountsByRequest(supabase as any, ids);
            setOfferCounts(counts);
          } catch {
            setOfferCounts({});
          }
        } else {
          setOfferCounts({});
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [activeTab, search, me, role]);

  return (
    <div className='p-6'>
      <div className='mb-6'>
        <h1 className='flex items-center gap-2 text-2xl font-bold'>
          Active Shipments.
        </h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          View and manage all your ongoing, requested, and archived shipments
          from this dashboard.
        </p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className='mb-4'>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {activeTab !== 'offers' ? (
        <ShipmentsTable
          data={(function () {
            let list =
              activeTab === 'requests' && hasOffersOnly
                ? data.filter((r: any) => (offerCounts[String(r.id)] || 0) > 0)
                : data;
            // If user is forwarder and we have offersData map, hide requests already offered
            if (
              activeTab === 'requests' &&
              role === 'forwarder' &&
              hideOffered
            ) {
              const myOffered = new Set(
                (offersData || [])
                  .filter(
                    (r: any) =>
                      r.my_offer &&
                      String(r.my_offer.forwarder_id) === String(me)
                  )
                  .map((r: any) => String(r.id))
              );
              if (myOffered.size)
                list = list.filter((r: any) => !myOffered.has(String(r.id)));
            }
            return list;
          })()}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          variant={
            activeTab === 'shipments' || activeTab === 'archive'
              ? 'shipments'
              : 'requests'
          }
          onRowClick={(row) => {
            if (activeTab === 'shipments' && row.code) {
              router.push(`/shipments/${row.code}`);
              return;
            }
            setSelected(row);
            setPanelOpen(true);
          }}
          offerCounts={activeTab === 'requests' ? offerCounts : undefined}
          offeredMap={
            activeTab === 'requests' && role === 'forwarder'
              ? (function () {
                  const map: Record<string, boolean> = {};
                  for (const r of offersData || []) {
                    if (
                      r.my_offer &&
                      String(r.my_offer.forwarder_id) === String(me)
                    )
                      map[String(r.id)] = true;
                  }
                  return map;
                })()
              : undefined
          }
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasOffersOnly={activeTab === 'requests' ? hasOffersOnly : undefined}
          onHasOffersOnlyChange={
            activeTab === 'requests' ? setHasOffersOnly : undefined
          }
          hideOffered={
            activeTab === 'requests' && role === 'forwarder'
              ? hideOffered
              : undefined
          }
          onHideOfferedChange={
            activeTab === 'requests' && role === 'forwarder'
              ? setHideOffered
              : undefined
          }
        />
      ) : (
        <ShipmentsTable
          data={offersData as any[] as any}
          loading={offersLoading}
          search={search}
          onSearchChange={setSearch}
          variant='requests'
          offeredMap={(function () {
            const map: Record<string, boolean> = {};
            for (const r of offersData || []) {
              if (r.my_offer && String(r.my_offer.forwarder_id) === String(me))
                map[String(r.id)] = true;
            }
            return map;
          })()}
          negotiationCounts={negotiationCountsByRequest}
          onRowClick={(row) => {
            const full = (offersData || []).find(
              (r: any) => String(r.id) === String(row.id)
            );
            const off = full?.my_offer || null;
            if (!off) return;
            setSelectedOffer(off);
            setOfferDialogOpen(true);
          }}
        />
      )}
      {/* Only show request details panel for Requests tab */}
      {activeTab === 'requests' && (
        <RequestDetailsPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          request={selected}
        />
      )}

      {/* Forwarder offer preview dialog (owner's dialog component) */}
      {offerDialogOpen && selectedOffer && (
        <OfferDetailsDialog
          open={offerDialogOpen}
          onClose={() => setOfferDialogOpen(false)}
          offer={selectedOffer}
          isOwner={false}
          // allow editing if this is my offer
          // @ts-ignore added optional props in component
          canEdit={selectedOffer.forwarder_id === me}
          // @ts-ignore
          onEdit={() => {
            setOfferDialogOpen(false);
            setEditOpen(true);
          }}
        />
      )}

      {/* Edit offer dialog with embedded form, prefilled with existing values */}
      {editOpen && selectedOffer && (
        <Dialog
          open={editOpen}
          onOpenChange={(v) => {
            if (!v) setEditOpen(false);
          }}
        >
          <DialogContent className='w-[95vw] sm:max-w-3xl'>
            <DialogHeader>
              <DialogTitle>Edit Offer</DialogTitle>
            </DialogHeader>
            <ForwarderOfferForm
              embedded
              useExternalFooter
              ref={offerFormRef}
              requestId={selectedOffer.request_id}
              forwarderId={me}
              // pass request details for budget validations
              requestDetails={(() => {
                const full = (offersData || []).find(
                  (r: any) => String(r.id) === String(selectedOffer.request_id)
                );
                return full?.details || {};
              })()}
              existingOffer={{
                id: selectedOffer.id,
                details: selectedOffer.details
              }}
              onStateChange={(s) => setFormState(s)}
              onSubmitted={async () => {
                // refresh list and close
                try {
                  const list = await getOffersForForwarder(supabase as any, me);
                  const ids = Array.from(
                    new Set((list || []).map((o: any) => o.request_id))
                  );
                  if (ids.length) {
                    const { data: reqs } = await (supabase as any)
                      .from('requests')
                      .select(
                        'id, code, user_id, details, status, freight_type, created_at, updated_at'
                      )
                      .in('id', ids);
                    const offerMap: Record<string, any> = {};
                    for (const o of list || [])
                      offerMap[String(o.request_id)] = o;
                    const enriched = (reqs || []).map((r: any) => ({
                      ...r,
                      my_offer: offerMap[String(r.id)] || null
                    }));
                    setOffersData(enriched);
                    // Recompute negotiation counts
                    try {
                      const myOfferIds = (list || []).map((o: any) => o.id);
                      if (myOfferIds.length) {
                        const { data: negs, error: nerr } = await (
                          supabase as any
                        )
                          .from('negotiations')
                          .select('offer_id')
                          .in('offer_id', myOfferIds as any);
                        if (!nerr) {
                          const byOffer: Record<string, number> = {};
                          for (const n of (negs || []) as any[])
                            byOffer[String(n.offer_id)] =
                              (byOffer[String(n.offer_id)] ?? 0) + 1;
                          const byRequest: Record<string, number> = {};
                          for (const r of enriched) {
                            const mo = r.my_offer;
                            if (mo) {
                              const c = byOffer[String(mo.id)] || 0;
                              if (c > 0) byRequest[String(r.id)] = c;
                            }
                          }
                          setNegotiationCountsByRequest(byRequest);
                        } else setNegotiationCountsByRequest({});
                      } else setNegotiationCountsByRequest({});
                    } catch {
                      setNegotiationCountsByRequest({});
                    }
                  }
                } catch {}
                setEditOpen(false);
              }}
            />
            <DialogFooter>
              <div className='flex w-full items-center justify-end gap-2'>
                <Button
                  variant='outline'
                  onClick={() => {
                    const st = offerFormRef.current?.getState();
                    if (!st || st.isFirst) setEditOpen(false);
                    else offerFormRef.current?.back();
                  }}
                >
                  {formState.isFirst ? 'Cancel' : 'Back'}
                </Button>
                {!formState.isLast ? (
                  <Button
                    disabled={!formState.currentValid}
                    onClick={() => offerFormRef.current?.next()}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    disabled={formState.submitting || !formState.currentValid}
                    onClick={() => offerFormRef.current?.submit()}
                  >
                    {formState.submitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
