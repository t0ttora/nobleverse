'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
import {
  Download,
  File,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Video,
  Eye,
  Trash
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

type DocType =
  | 'commercial_invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'certificate_of_origin'
  | 'insurance'
  | 'import_license'
  | 'custom';

const COMMON_DOCS: Array<{ key: DocType; label: string }> = [
  { key: 'commercial_invoice', label: 'Commercial Invoice' },
  { key: 'packing_list', label: 'Packing List' },
  { key: 'bill_of_lading', label: 'Bill of Lading' },
  { key: 'certificate_of_origin', label: 'Certificate of Origin' },
  { key: 'insurance', label: 'Insurance Certificate' },
  { key: 'import_license', label: 'Import License' }
];

export default function DocumentsTab({ shipment }: { shipment: any }) {
  const shipmentId: string = shipment?.id;
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string>('');
  const [selected, setSelected] = useState<Record<DocType, boolean>>({
    commercial_invoice: false,
    packing_list: false,
    bill_of_lading: false,
    certificate_of_origin: false,
    insurance: false,
    import_license: false,
    custom: false
  });
  // Custom document ask: enter a name and add to a list; stored as type 'custom' with label in note field when inserting
  const [customDocName, setCustomDocName] = useState('');
  const [customDocs, setCustomDocs] = useState<string[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    null
  );
  // Persisted user templates (from settings.profile.doc_templates)
  const [templates, setTemplates] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id || ''));
  }, []);

  // Load user templates once user is known
  useEffect(() => {
    (async () => {
      if (!me) return;
      const { data } = await supabase
        .from('settings')
        .select('profile')
        .eq('user_id', me)
        .maybeSingle();
      const arr = (data?.profile?.doc_templates as string[]) || [];
      setTemplates(arr);
      // ensure selected map keys exist
      const map: Record<string, boolean> = {};
      arr.forEach((t) => (map[t] = false));
      setSelectedTemplates(map);
    })();
  }, [me]);

  async function refresh() {
    try {
      const { data, error } = await supabase.storage
        .from('shipments')
        .list(shipmentId, {
          limit: 200,
          sortBy: { column: 'name', order: 'asc' } as any
        });
      if (error) throw error;
      setFiles(data || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load documents');
      setFiles([]);
    }
  }
  useEffect(() => {
    refresh();
  }, [shipmentId]);

  async function refreshRequests() {
    if (!shipmentId || !me) return;
    try {
      const { data } = await supabase
        .from('document_requests')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false });
      setRequests((data as any) || []);
    } catch {
      setRequests([]);
    }
  }
  useEffect(() => {
    void refreshRequests();
  }, [shipmentId, me]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    // Prefix filename with short uploader id so we can group by participant without changing folder layout
    const short = me ? String(me).slice(0, 8) : 'anon';
    const path = `${shipmentId}/u_${short}_${Date.now()}_${f.name}`;
    const { error } = await supabase.storage.from('shipments').upload(path, f);
    setUploading(false);
    // Clear input so selecting the same file again triggers onChange
    try {
      (e.target as HTMLInputElement).value = '';
    } catch {}
    if (error) {
      setError(error.message || 'Upload failed');
      return;
    }
    setError(null);
    await refresh();
  }

  async function onFulfillUpload(req: any, file: File) {
    try {
      setUploadingFor(req.id);
      const path = `docs/requests/${req.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('shipments')
        .upload(path, file);
      if (error) throw error;
      await supabase
        .from('document_requests')
        .update({ status: 'fulfilled', file_path: path })
        .eq('id', req.id);
      void refreshRequests();
    } catch {
      /* ignore */
    } finally {
      setUploadingFor(null);
    }
  }

  const counterpartyId: string | null = useMemo(() => {
    if (!me || !shipment) return null;
    if (shipment.owner_id === me) return shipment.forwarder_id || null;
    if (shipment.forwarder_id === me) return shipment.owner_id || null;
    // Fallback: first participant that isn't me
    if (Array.isArray(shipment.participants))
      return shipment.participants.find((p: string) => p !== me) || null;
    return null;
  }, [me, shipment]);

  function toggle(key: DocType) {
    setSelected((cur) => ({ ...cur, [key]: !cur[key] }));
  }

  function addCustom() {
    const label = customDocName.trim();
    if (!label) return;
    setCustomDocs((arr) => (arr.includes(label) ? arr : [...arr, label]));
    // Persist into user templates for next time
    (async () => {
      if (!me) return;
      const next = Array.from(new Set([...(templates || []), label]));
      setTemplates(next);
      setSelectedTemplates((m) => ({ ...m, [label]: false }));
      // upsert settings row
      const { data } = await supabase
        .from('settings')
        .select('user_id')
        .eq('user_id', me)
        .maybeSingle();
      if (data) {
        await supabase
          .from('settings')
          .update({ profile: { doc_templates: next } as any })
          .eq('user_id', me);
      } else {
        await supabase
          .from('settings')
          .insert({ user_id: me, profile: { doc_templates: next } });
      }
    })();
    setCustomDocName('');
  }

  function removeCustom(label: string) {
    setCustomDocs((arr) => arr.filter((x) => x !== label));
  }

  async function submitRequest() {
    const keys = (Object.keys(selected) as DocType[]).filter(
      (k) => selected[k]
    );
    const chosenTemplates = Object.keys(selectedTemplates).filter(
      (k) => selectedTemplates[k]
    );
    if (
      (!keys.length &&
        customDocs.length === 0 &&
        chosenTemplates.length === 0) ||
      !me ||
      !counterpartyId
    )
      return;
    try {
      const baseRows = keys
        .filter((k) => k !== 'custom')
        .map((k) => ({
          requester_id: me,
          receiver_id: counterpartyId,
          shipment_id: shipmentId,
          type: k,
          note: null,
          status: 'pending' as const
        }));
      const customRows = customDocs.map((label) => ({
        requester_id: me,
        receiver_id: counterpartyId,
        shipment_id: shipmentId,
        type: 'custom' as const,
        note: label,
        status: 'pending' as const
      }));
      const templateRows = chosenTemplates.map((label) => ({
        requester_id: me,
        receiver_id: counterpartyId,
        shipment_id: shipmentId,
        type: 'custom' as const,
        note: label,
        status: 'pending' as const
      }));
      const rows = [...baseRows, ...customRows, ...templateRows];
      const { data: inserted, error: insertErr } = await supabase
        .from('document_requests')
        .insert(rows)
        .select('*');
      if (insertErr) throw insertErr;
      // Optimistic: merge inserted into local list so Outgoing shows immediately
      if (Array.isArray(inserted)) {
        setRequests((prev) => [...inserted, ...prev]);
      }
      setSelected({
        commercial_invoice: false,
        packing_list: false,
        bill_of_lading: false,
        certificate_of_origin: false,
        insurance: false,
        import_license: false,
        custom: false
      });
      setCustomDocs([]);
      setSelectedTemplates((m) =>
        Object.fromEntries(Object.keys(m).map((k) => [k, false]))
      );
      void refreshRequests();
    } catch (e: any) {
      setError(e?.message || 'Failed to create requests');
    }
  }

  function iconFor(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (!ext) return <File className='size-4' />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext))
      return <ImageIcon className='size-4' />;
    if (['mp4', 'mov', 'webm', 'avi'].includes(ext))
      return <Video className='size-4' />;
    if (['pdf'].includes(ext)) return <FileText className='size-4' />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
      return <FileArchive className='size-4' />;
    return <File className='size-4' />;
  }

  const publicBase = useMemo(() => {
    try {
      // Base URL for the bucket; getPublicUrl will handle full path per file
      return supabase.storage.from('shipments');
    } catch {
      return null;
    }
  }, []);

  // Derive per-participant file groupings by parsing the uploader prefix.
  const shortMe = useMemo(() => (me ? String(me).slice(0, 8) : ''), [me]);
  const shortCounter = useMemo(
    () => (counterpartyId ? String(counterpartyId).slice(0, 8) : ''),
    [counterpartyId]
  );
  const mine = useMemo(() => {
    return files.filter(
      (f) => typeof f.name === 'string' && f.name.startsWith(`u_${shortMe}_`)
    );
  }, [files, shortMe]);
  const theirs = useMemo(() => {
    return files.filter(
      (f) =>
        typeof f.name === 'string' &&
        shortCounter &&
        f.name.startsWith(`u_${shortCounter}_`)
    );
  }, [files, shortCounter]);

  return (
    <div className='space-y-4'>
      <Tabs defaultValue='all'>
        <div className='flex items-center justify-between gap-2'>
          <TabsList className='scrollbar-thin w-full justify-start overflow-x-auto'>
            <TabsTrigger value='all'>All Documents</TabsTrigger>
            <TabsTrigger value='incoming'>Incoming Requests</TabsTrigger>
          </TabsList>
          <div className='flex flex-shrink-0 items-center gap-2'>
            <input
              id='doc_upload'
              type='file'
              className='hidden'
              onChange={onUpload}
            />
            <Button
              size='sm'
              onClick={() => document.getElementById('doc_upload')?.click()}
              disabled={uploading}
            >
              + Upload Document
            </Button>
            <RequestDocsButton
              disabled={!counterpartyId}
              onOpenDialog={() => void 0}
              trigger={
                <Button
                  size='sm'
                  variant='secondary'
                  disabled={!counterpartyId}
                >
                  + Request Documents
                </Button>
              }
              content={
                <RequestBuilder
                  selected={selected}
                  onToggle={toggle}
                  templates={templates}
                  selectedTemplates={selectedTemplates}
                  setSelectedTemplates={setSelectedTemplates}
                  customDocName={customDocName}
                  setCustomDocName={setCustomDocName}
                  customDocs={customDocs}
                  addCustom={addCustom}
                  removeCustom={removeCustom}
                  onSubmit={submitRequest}
                  counterpartyDetected={!!counterpartyId}
                />
              }
            />
          </div>
        </div>
        {error && <div className='text-destructive mt-1 text-xs'>{error}</div>}
        <TabsContent value='all'>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'>
            {files.map((f) => {
              const url = publicBase
                ? publicBase.getPublicUrl(`${shipmentId}/${f.name}`).data
                    .publicUrl
                : '#';
              return (
                <Card key={f.name} className='rounded-lg border p-3'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='flex min-w-0 items-center gap-2'>
                      <span className='bg-muted text-muted-foreground inline-flex items-center justify-center rounded-md p-1'>
                        {iconFor(f.name)}
                      </span>
                      <div className='min-w-0'>
                        <div
                          className='truncate text-sm font-medium'
                          title={f.name}
                        >
                          {f.name}
                        </div>
                        <div className='text-muted-foreground text-[11px]'>
                          {f.updated_at
                            ? new Date(f.updated_at).toLocaleString()
                            : ''}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='h-7 px-2 text-xs'
                        onClick={() => setPreview({ url, name: f.name })}
                      >
                        <Eye className='mr-1 size-3' /> Preview
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        className='text-destructive h-7 px-2 text-xs'
                        onClick={async () => {
                          await supabase.storage
                            .from('shipments')
                            .remove([`${shipmentId}/${f.name}`]);
                          await refresh();
                        }}
                      >
                        <Trash className='mr-1 size-3' /> Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {files.length === 0 && !error && (
            <EmptyState
              title='No documents'
              subtitle='Upload files to get started.'
            />
          )}
        </TabsContent>
        <TabsContent value='incoming'>
          <div className='space-y-2'>
            {requests
              .filter((r) => r.receiver_id === me)
              .map((r) => (
                <Card key={r.id} className='rounded-lg border p-3 text-sm'>
                  <div className='flex items-center justify-between gap-2'>
                    <div>
                      <div className='font-medium'>
                        {r.type === 'custom'
                          ? r.note || 'Custom document'
                          : COMMON_DOCS.find((d) => d.key === r.type)?.label ||
                            r.type}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        From: {String(r.requester_id).slice(0, 8)} •{' '}
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {r.status !== 'fulfilled' ? (
                        <label className='hover:bg-accent/50 inline-flex cursor-pointer items-center rounded-full border px-2 py-1 text-xs'>
                          <input
                            type='file'
                            className='hidden'
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void onFulfillUpload(r, f);
                            }}
                          />
                          <span>
                            {uploadingFor === r.id ? 'Uploading…' : 'Upload'}
                          </span>
                        </label>
                      ) : (
                        <div className='flex items-center gap-2'>
                          <Button
                            size='sm'
                            variant='ghost'
                            className='h-7 px-2 text-xs'
                            onClick={() => {
                              const url = r.file_path
                                ? supabase.storage
                                    .from('shipments')
                                    .getPublicUrl(r.file_path).data.publicUrl
                                : '#';
                              setPreview({ url, name: r.file_path || 'file' });
                            }}
                          >
                            <Eye className='mr-1 size-3' /> Preview
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            className='text-destructive h-7 px-2 text-xs'
                            onClick={async () => {
                              if (r.file_path) {
                                await supabase.storage
                                  .from('shipments')
                                  .remove([r.file_path]);
                              }
                              await supabase
                                .from('document_requests')
                                .update({ status: 'pending', file_path: null })
                                .eq('id', r.id);
                              void refreshRequests();
                            }}
                          >
                            <Trash className='mr-1 size-3' /> Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            {requests.filter((r) => r.receiver_id === me).length === 0 && (
              <EmptyState
                title='No incoming requests'
                subtitle='Requests from your counterparty will appear here.'
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className='sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle className='truncate'>
              {preview?.name || 'Preview'}
            </DialogTitle>
          </DialogHeader>
          {preview?.url && (
            <div className='mt-2 h-[70vh] w-full'>
              {(() => {
                const name = preview.name.toLowerCase();
                const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/.test(name);
                const isPdf = /\.(pdf)$/.test(name);
                const isVideo = /\.(mp4|webm|mov|avi)$/.test(name);
                if (isImage)
                  return (
                    <img
                      src={preview.url}
                      alt='preview'
                      className='h-full w-full rounded-md object-contain'
                    />
                  );
                if (isPdf)
                  return (
                    <iframe
                      src={preview.url}
                      className='h-full w-full rounded-md'
                      title='PDF preview'
                    />
                  );
                if (isVideo)
                  return (
                    <video
                      src={preview.url}
                      controls
                      className='h-full w-full rounded-md'
                    />
                  );
                return (
                  <div className='text-sm'>
                    Preview not available.{' '}
                    <a
                      className='text-primary underline'
                      href={preview.url}
                      target='_blank'
                      rel='noreferrer'
                    >
                      Open
                    </a>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestDocsButton({
  trigger,
  content,
  disabled
}: {
  trigger: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
  onOpenDialog?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <span className={disabled ? 'pointer-events-none opacity-60' : ''}>
          {trigger}
        </span>
      </DialogTrigger>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Request Documents</DialogTitle>
        </DialogHeader>
        <div className='max-h-[70vh] overflow-auto pr-1'>{content}</div>
      </DialogContent>
    </Dialog>
  );
}

function RequestBuilder(props: {
  selected: Record<DocType, boolean>;
  onToggle: (k: DocType) => void;
  templates: string[];
  selectedTemplates: Record<string, boolean>;
  setSelectedTemplates: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  customDocName: string;
  setCustomDocName: (v: string) => void;
  customDocs: string[];
  addCustom: () => void;
  removeCustom: (label: string) => void;
  onSubmit: () => void;
  counterpartyDetected: boolean;
}) {
  const {
    selected,
    onToggle,
    templates,
    selectedTemplates,
    setSelectedTemplates,
    customDocName,
    setCustomDocName,
    customDocs,
    addCustom,
    removeCustom,
    onSubmit,
    counterpartyDetected
  } = props;
  return (
    <div className='space-y-4'>
      <div>
        <div className='mb-2 text-sm font-medium'>Select documents</div>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
          {COMMON_DOCS.map((d) => (
            <label
              key={d.key}
              className='hover:bg-accent/40 flex items-center gap-2 rounded-md border p-2'
            >
              <Checkbox
                checked={!!selected[d.key]}
                onCheckedChange={() => onToggle(d.key)}
              />
              <span className='text-sm'>{d.label}</span>
            </label>
          ))}
        </div>
      </div>
      {templates.length > 0 && (
        <div>
          <div className='text-muted-foreground mb-1 text-xs'>
            Your templates
          </div>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            {templates.map((t) => (
              <label
                key={t}
                className='hover:bg-accent/40 flex items-center gap-2 rounded-md border p-2'
              >
                <Checkbox
                  checked={!!selectedTemplates[t]}
                  onCheckedChange={() =>
                    setSelectedTemplates((m) => ({ ...m, [t]: !m[t] }))
                  }
                />
                <span className='text-sm'>{t}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className='text-muted-foreground mb-1 text-xs'>
          Ask a specific document (custom name)
        </div>
        <div className='flex items-center gap-2'>
          <Input
            placeholder='e.g. SGS Inspection Report'
            value={customDocName}
            onChange={(e) => setCustomDocName(e.target.value)}
            className='max-w-sm'
          />
          <Button
            size='sm'
            variant='outline'
            onClick={addCustom}
            disabled={!customDocName.trim()}
          >
            Add
          </Button>
        </div>
        {customDocs.length > 0 && (
          <div className='mt-2 flex flex-wrap gap-2'>
            {customDocs.map((label) => (
              <span
                key={label}
                className='bg-accent/50 text-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs'
              >
                {label}
                <button
                  onClick={() => removeCustom(label)}
                  className='text-muted-foreground hover:text-foreground rounded bg-transparent px-1'
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className='flex items-center gap-2'>
        <Button size='sm' onClick={onSubmit} disabled={!counterpartyDetected}>
          Request Selected
        </Button>
        {!counterpartyDetected && (
          <span className='text-muted-foreground text-xs'>
            Counterparty not detected
          </span>
        )}
      </div>
    </div>
  );
}
