'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Loader2, Folder, File as FileIcon, FileText } from 'lucide-react';

const FILES_BUCKET = process.env.NEXT_PUBLIC_FILES_BUCKET || 'files';

export type NobleAction = {
  label: string;
  action: string;
  payload?: Record<string, any>;
};

export type NobleCard =
  | {
      type: 'shipment_card';
      id: string;
      title?: string;
      status?: string;
      origin?: string;
      destination?: string;
      eta?: string;
      last_update?: string;
      documents?: { name: string; id: string; url?: string }[];
      actions?: NobleAction[];
    }
  | {
      type: 'calendar_card';
      id: string;
      title?: string;
      starts_at?: string;
      ends_at?: string;
      location?: string;
      notes?: string;
      actions?: NobleAction[];
    }
  | {
      type: 'request_card';
      id: string;
      requester?: string;
      cargo?: Record<string, any>;
      route?: { origin?: string; destination?: string };
      deadline?: string;
      special_requirements?: string[];
      status?: string;
      actions?: NobleAction[];
    }
  | {
      type: 'negotiation_card';
      id: string;
      related_request?: string; // may be numeric id
      request_code?: string; // human-friendly code from requests table
      forwarder?: string;
      offer?: {
        price?: string;
        transit_time?: string;
        valid_until?: string;
        conditions?: string[];
      };
      status?: string;
      actions?: NobleAction[];
    }
  | {
      type: 'invoice_card';
      id: string;
      amount?: string;
      due_date?: string;
      status?: string;
      actions?: NobleAction[];
    }
  | {
      type: 'payment_status_card';
      id: string;
      invoice_id?: string;
      status?: string;
      timestamp?: string;
      actions?: NobleAction[];
    }
  | {
      type: 'payment_status_card';
      id: string;
      invoice_id?: string;
      status?: string;
      timestamp?: string;
      actions?: NobleAction[];
    }
  | {
      type: 'task_card';
      id: string;
      title?: string;
      assigned_to?: string;
      deadline?: string;
      status?: string;
      actions?: NobleAction[];
    }
  | {
      type: 'suite_files_card';
      title: string;
      subtitle?: string;
      breadcrumb?: { id: string | null; name: string }[];
      items: Array<{
        id: string;
        kind: 'file' | 'folder';
        name: string;
        size_bytes?: number | null;
        updated_at?: string | null;
        storage_path?: string | null;
        parent_id?: string | null;
        visibility?: string | null;
        ext?: string | null;
      }>;
      actions?: NobleAction[];
    }
  | {
      type: 'approval_card';
      id: string;
      subject?: string;
      status?: string;
      actions?: NobleAction[];
    }
  | {
      type: 'note_card';
      id: string;
      linked_to?: string;
      author?: string;
      content?: string;
      timestamp?: string;
      actions?: NobleAction[];
    };

type SuiteFilesCard = Extract<NobleCard, { type: 'suite_files_card' }>;
type SuiteFilesCardItem = SuiteFilesCard['items'][number];

export type UserRole = 'owner' | 'forwarder' | 'customs_broker' | 'finance';

export function CardRenderer({
  card,
  onAction,
  userRole
}: {
  card: NobleCard;
  onAction?: (a: NobleAction, card: NobleCard) => void;
  userRole?: UserRole;
}) {
  const roleActions = userRole ? buildRoleActions(card, userRole) : undefined;
  switch (card.type) {
    case 'calendar_card':
      return (
        <BaseCard
          typeLabel='Calendar'
          title={card.title || 'Calendar'}
          status={undefined}
          meta={[
            card.starts_at ? `Start ${formatDate(card.starts_at)}` : undefined,
            card.ends_at ? `End ${formatDate(card.ends_at)}` : undefined,
            card.location ? `@ ${card.location}` : undefined
          ]}
        >
          {card.notes && (
            <div className='mt-2 text-sm break-words whitespace-pre-wrap'>
              {card.notes}
            </div>
          )}
          <Actions
            actions={
              card.actions && card.actions.length
                ? card.actions
                : [
                    {
                      label: '➕ Add to Calendar',
                      action: 'add_to_calendar',
                      payload: {
                        title: card.title,
                        starts_at: card.starts_at,
                        ends_at: card.ends_at,
                        location: card.location
                      }
                    }
                  ]
            }
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    case 'shipment_card':
      return (
        <BaseCard
          typeLabel='Shipment'
          title={
            ((card as any).code as string) || (card.id as string) || 'Shipment'
          }
          status={card.status}
          meta={[
            card.origin && card.destination
              ? `${card.origin} → ${card.destination}`
              : undefined,
            card.eta ? `ETA ${formatDate(card.eta)}` : undefined,
            card.last_update ? `Last: ${card.last_update}` : undefined
          ]}
        >
          {card.documents && card.documents.length > 0 && (
            <div className='mt-2 text-xs'>
              <div className='mb-1 font-medium'>Documents</div>
              <ul className='space-y-1'>
                {card.documents.map((d) => (
                  <li key={d.id} className='flex items-center gap-2'>
                    <span className='bg-muted inline-flex size-5 items-center justify-center rounded text-[10px]'>
                      DOC
                    </span>
                    {d.url ? (
                      <a
                        className='text-primary truncate hover:underline'
                        href={d.url}
                        target='_blank'
                        rel='noreferrer noopener'
                      >
                        {d.name}
                      </a>
                    ) : (
                      <span className='truncate'>{d.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Actions
            actions={roleActions || card.actions}
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    case 'request_card':
      return (
        <BaseCard
          typeLabel='Request'
          title={
            ((card as any).request_code as string) ||
            (card.id as string) ||
            'Request'
          }
          status={card.status}
          meta={[
            card.requester ? `Requester: ${card.requester}` : undefined,
            card.route?.origin && card.route?.destination
              ? `${card.route.origin} → ${card.route.destination}`
              : undefined,
            card.deadline ? `Deadline ${formatDate(card.deadline)}` : undefined
          ]}
        >
          {card.cargo && (
            <div className='mt-2 grid grid-cols-2 gap-2 text-xs'>
              {Object.entries(card.cargo).map(([k, v]) => (
                <div key={k} className='flex items-center gap-2'>
                  <span className='text-muted-foreground capitalize'>
                    {k.replace(/_/g, ' ')}
                  </span>
                  <span className='truncate font-medium'>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          <Actions
            actions={roleActions || card.actions}
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    case 'negotiation_card':
      return (
        <NegotiationCardView
          card={card}
          actions={roleActions || card.actions}
          onAction={onAction}
        />
      );
    case 'invoice_card':
      return (
        <BaseCard
          typeLabel='Invoice'
          title='Invoice'
          status={card.status}
          meta={[
            card.amount ? `Amount: ${card.amount}` : undefined,
            card.due_date ? `Due ${formatDate(card.due_date)}` : undefined
          ]}
        >
          <Actions
            actions={roleActions || card.actions}
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    case 'payment_status_card':
      return (
        <BaseCard
          typeLabel='Payment'
          title='Payment'
          status={card.status}
          meta={[
            card.invoice_id ? `Invoice ${card.invoice_id}` : undefined,
            card.timestamp ? `Updated ${formatDate(card.timestamp)}` : undefined
          ]}
        >
          <Actions
            actions={roleActions || card.actions}
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    case 'suite_files_card': {
      const meta: (string | undefined)[] = [];
      if (card.subtitle) meta.push(card.subtitle);
      meta.push(
        `${card.items.length} item${card.items.length === 1 ? '' : 's'}`
      );
      return (
        <BaseCard
          typeLabel='Suite'
          title={card.title || 'Suite Files'}
          status={undefined}
          meta={meta}
        >
          <div className='mt-3 space-y-2'>
            {card.items.map((item) => (
              <SuiteFileRow key={item.id} item={item} />
            ))}
          </div>
          <Actions
            actions={card.actions}
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    }
    case 'task_card':
      return (
        <BaseCard
          typeLabel='Task'
          title={card.title || 'Task'}
          status={card.status}
          meta={[
            card.assigned_to ? `Assignee: ${card.assigned_to}` : undefined,
            card.deadline ? `Due ${formatDate(card.deadline)}` : undefined
          ]}
        >
          <Actions
            actions={roleActions || card.actions}
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    case 'approval_card':
      return (
        <BaseCard
          typeLabel='Approval'
          title={card.subject || 'Approval'}
          status={card.status}
        >
          <Actions
            actions={roleActions || card.actions}
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    case 'note_card':
      return (
        <BaseCard typeLabel='Note' title={'Note'} status={(card as any).status}>
          {card.author && (
            <div className='text-muted-foreground text-xs'>
              By {card.author}
              {(card.timestamp && ` • ${formatDate(card.timestamp)}`) || ''}
            </div>
          )}
          {card.content && (
            <div className='mt-2 text-sm break-words whitespace-pre-wrap'>
              {card.content}
            </div>
          )}
          <Actions
            actions={roleActions || (card as any).actions}
            onAction={(a) => onAction?.(a, card)}
          />
        </BaseCard>
      );
    // exhaustive check
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    default: {
      const _exhaustive: never = card;
      return null;
    }
  }
}

function buildRoleActions(
  card: NobleCard,
  role: UserRole
): NobleAction[] | undefined {
  const id = (card as any).id as string | undefined;
  switch (card.type) {
    case 'shipment_card': {
      if (role === 'owner')
        return [
          {
            label: '📍 Track Live Shipment',
            action: 'open_tracking',
            payload: { shipment_id: id }
          },
          {
            label: '📝 Report Issue',
            action: 'report_issue',
            payload: { shipment_id: id }
          }
        ];
      if (role === 'forwarder')
        return [
          {
            label: '📤 Update Status',
            action: 'update_status',
            payload: { shipment_id: id }
          },
          {
            label: '📎 Upload Document',
            action: 'upload_document',
            payload: { shipment_id: id }
          }
        ];
      if (role === 'customs_broker')
        return [
          {
            label: '✅ Mark Customs Cleared',
            action: 'mark_customs_cleared',
            payload: { shipment_id: id }
          },
          {
            label: '📑 Request Missing Docs',
            action: 'request_missing_docs',
            payload: { shipment_id: id }
          }
        ];
      if (role === 'finance')
        return [
          {
            label: '💵 View Related Invoice',
            action: 'open_invoice_list',
            payload: { shipment_id: id }
          },
          {
            label: '🔎 Match Payment',
            action: 'match_payment',
            payload: { shipment_id: id }
          }
        ];
      break;
    }
    case 'request_card': {
      if (role === 'owner')
        return [
          {
            label: '👀 View Request Details',
            action: 'open_request_details',
            payload: { request_id: id }
          },
          {
            label: '📊 See Offers',
            action: 'open_offers',
            payload: { request_id: id }
          }
        ];
      if (role === 'forwarder')
        return [
          {
            label: '💬 Ask Question',
            action: 'open_chat_thread',
            payload: { request_id: id }
          },
          {
            label: '💰 Submit Offer',
            action: 'create_offer',
            payload: { request_id: id }
          }
        ];
      if (role === 'customs_broker')
        return [
          {
            label: '📑 View Requirements',
            action: 'open_request_requirements',
            payload: { request_id: id }
          },
          {
            label: '🚨 Flag Compliance Risk',
            action: 'flag_compliance_risk',
            payload: { request_id: id }
          }
        ];
      if (role === 'finance')
        return [
          {
            label: '👁 View Cost Estimate',
            action: 'open_cost_estimate',
            payload: { request_id: id }
          },
          {
            label: '📌 Save for Review',
            action: 'save_for_review',
            payload: { request_id: id }
          }
        ];
      break;
    }
    case 'negotiation_card': {
      if (role === 'owner')
        return [
          {
            label: '✅ Accept Offer',
            action: 'accept_offer',
            payload: { offer_id: (card as any).offer_id || undefined }
          },
          {
            label: '✏️ Counter Offer',
            action: 'counter_offer',
            payload: { offer_id: (card as any).offer_id || undefined }
          }
        ];
      if (role === 'forwarder')
        return [
          {
            label: '🔄 Revise Offer',
            action: 'counter_offer',
            payload: { offer_id: (card as any).offer_id || undefined }
          },
          {
            label: '❌ Withdraw Offer',
            action: 'withdraw_offer',
            payload: { offer_id: (card as any).offer_id || undefined }
          }
        ];
      if (role === 'customs_broker')
        return [
          {
            label: '📖 View Terms (read-only)',
            action: 'open_request_details',
            payload: { request_id: (card as any).related_request }
          },
          {
            label: '📝 Add Compliance Note',
            action: 'add_compliance_note',
            payload: { request_id: (card as any).related_request }
          }
        ];
      if (role === 'finance')
        return [
          {
            label: '💵 Preview Payment Terms',
            action: 'open_invoice_list',
            payload: { request_id: (card as any).related_request }
          },
          {
            label: '🚩 Flag Credit Risk',
            action: 'flag_credit_risk',
            payload: { request_id: (card as any).related_request }
          }
        ];
      break;
    }
    case 'invoice_card': {
      if (role === 'owner')
        return [
          {
            label: '📥 Download Invoice',
            action: 'download_invoice',
            payload: { invoice_id: id }
          },
          {
            label: '⚠️ Dispute Invoice',
            action: 'dispute_invoice',
            payload: { invoice_id: id }
          }
        ];
      if (role === 'forwarder')
        return [
          {
            label: '🧾 Issue Invoice',
            action: 'issue_invoice',
            payload: { invoice_id: id }
          },
          {
            label: '✏️ Update Invoice Info',
            action: 'update_invoice_info',
            payload: { invoice_id: id }
          }
        ];
      if (role === 'finance')
        return [
          {
            label: '✅ Approve Payment',
            action: 'approve_payment',
            payload: { invoice_id: id }
          },
          {
            label: '📆 Track Due Date',
            action: 'open_invoice_list',
            payload: { invoice_id: id }
          }
        ];
      if (role === 'customs_broker')
        return [
          {
            label: '📖 View Invoice Docs',
            action: 'open_invoice_list',
            payload: { invoice_id: id }
          },
          {
            label: '🗂 Link to Customs File',
            action: 'link_customs_file',
            payload: { invoice_id: id }
          }
        ];
      break;
    }
    case 'payment_status_card': {
      if (role === 'owner')
        return [
          {
            label: '👀 View Payment Status',
            action: 'open_invoice_list',
            payload: { invoice_id: id }
          },
          {
            label: '📄 Download Receipt',
            action: 'download_receipt',
            payload: { invoice_id: id }
          }
        ];
      if (role === 'forwarder')
        return [
          {
            label: '🔎 Verify Payment',
            action: 'verify_payment',
            payload: { invoice_id: id }
          },
          {
            label: '⏰ Send Reminder',
            action: 'send_payment_reminder',
            payload: { invoice_id: id }
          }
        ];
      if (role === 'finance')
        return [
          {
            label: '🧾 Reconcile Payment',
            action: 'reconcile_payment',
            payload: { invoice_id: id }
          },
          {
            label: '🔁 Approve Refund',
            action: 'approve_refund',
            payload: { invoice_id: id }
          }
        ];
      if (role === 'customs_broker')
        return [
          {
            label: '👁 View Payment Note',
            action: 'open_invoice_list',
            payload: { invoice_id: id }
          },
          {
            label: '📂 Link to Clearance Task',
            action: 'link_clearance_task',
            payload: { invoice_id: id }
          }
        ];
      break;
    }
    case 'task_card': {
      if (role === 'owner')
        return [
          {
            label: '📝 Create Task',
            action: 'create_task',
            payload: { task_id: id }
          },
          {
            label: '👀 Monitor Progress',
            action: 'open_tasks',
            payload: { task_id: id }
          }
        ];
      if (role === 'forwarder')
        return [
          {
            label: '✅ Mark Done',
            action: 'complete_task',
            payload: { task_id: id }
          },
          {
            label: '👤 Reassign Task',
            action: 'reassign_task',
            payload: { task_id: id }
          }
        ];
      if (role === 'customs_broker')
        return [
          {
            label: '📥 Accept Task',
            action: 'accept_task',
            payload: { task_id: id }
          },
          {
            label: '📎 Upload Document',
            action: 'upload_task_document',
            payload: { task_id: id }
          }
        ];
      if (role === 'finance')
        return [
          {
            label: '💰 Approve Expense Task',
            action: 'approve_expense_task',
            payload: { task_id: id }
          },
          {
            label: '📊 Review Cost Impact',
            action: 'review_cost_impact',
            payload: { task_id: id }
          }
        ];
      break;
    }
    case 'approval_card': {
      if (role === 'owner')
        return [
          {
            label: '✅ Approve Change',
            action: 'approve_item',
            payload: { approval_id: id }
          },
          {
            label: '✏️ Request Revision',
            action: 'request_revision',
            payload: { approval_id: id }
          }
        ];
      if (role === 'forwarder')
        return [
          {
            label: '📤 Request Approval',
            action: 'request_approval',
            payload: { approval_id: id }
          },
          {
            label: '⏳ Track Approval Status',
            action: 'open_approvals',
            payload: { approval_id: id }
          }
        ];
      if (role === 'finance')
        return [
          {
            label: '💵 Approve Cost Update',
            action: 'approve_cost_update',
            payload: { approval_id: id }
          },
          {
            label: '❌ Reject Cost Update',
            action: 'reject_cost_update',
            payload: { approval_id: id }
          }
        ];
      if (role === 'customs_broker')
        return [
          {
            label: '✅ Approve Compliance Docs',
            action: 'approve_compliance_docs',
            payload: { approval_id: id }
          },
          {
            label: '📑 Request Missing Docs',
            action: 'request_missing_docs',
            payload: { approval_id: id }
          }
        ];
      break;
    }
    case 'note_card': {
      if (role === 'owner')
        return [
          {
            label: '💬 Reply to Note',
            action: 'reply_note',
            payload: { note_id: id }
          },
          { label: '📌 Pin Note', action: 'pin_note', payload: { note_id: id } }
        ];
      if (role === 'forwarder')
        return [
          {
            label: '📝 Add Comment',
            action: 'reply_note',
            payload: { note_id: id }
          },
          {
            label: '🔄 Share in Chat',
            action: 'share_note',
            payload: { note_id: id }
          }
        ];
      if (role === 'customs_broker')
        return [
          {
            label: '📥 Attach Compliance File',
            action: 'attach_compliance_file',
            payload: { note_id: id }
          },
          {
            label: '🗒 Add Customs Note',
            action: 'add_customs_note',
            payload: { note_id: id }
          }
        ];
      if (role === 'finance')
        return [
          {
            label: '💬 Reply with Finance Comment',
            action: 'reply_note',
            payload: { note_id: id }
          },
          {
            label: '📎 Link to Invoice',
            action: 'open_invoice_list',
            payload: {}
          }
        ];
      break;
    }
  }
  return undefined;
}

function NegotiationCardView({
  card,
  actions,
  onAction
}: {
  card: Extract<NobleCard, { type: 'negotiation_card' }>;
  actions?: NobleAction[];
  onAction?: (a: NobleAction, card: NobleCard) => void;
}) {
  const [code, setCode] = React.useState<string | undefined>(
    (card as any).request_code
  );
  // Fetch code if missing, using related_request as numeric id
  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (code) return;
        const rid = (card.related_request || '').toString().trim();
        if (!rid) return;
        // If rid already looks like a code (contains a dash), use it
        if (rid.includes('-')) {
          if (alive) setCode(rid);
          return;
        }
        const idNum = Number(rid);
        if (!Number.isFinite(idNum)) return;
        const { data, error } = await supabase
          .from('requests')
          .select('code')
          .eq('id', idNum)
          .single();
        if (!error && data?.code && alive) setCode(data.code as string);
      } catch {
        /* ignore */
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [card.related_request, code]);

  const title = code || (card.related_request as string) || 'Negotiation';
  const meta = [
    code || card.related_request
      ? `Request ${code || card.related_request}`
      : undefined,
    card.forwarder ? `Forwarder: ${card.forwarder}` : undefined,
    card.offer?.valid_until
      ? `Valid until ${formatDate(card.offer.valid_until)}`
      : undefined
  ];

  return (
    <BaseCard typeLabel='Offer' title={title} status={card.status} meta={meta}>
      {card.offer && (
        <div className='mt-2 grid grid-cols-3 gap-2 text-xs'>
          {card.offer.price && (
            <InfoTile label='Original Budget' value={card.offer.price} />
          )}
          {card.offer.transit_time && (
            <InfoTile label='Transit' value={card.offer.transit_time} />
          )}
          {card.offer.conditions && card.offer.conditions.length > 0 && (
            <div className='col-span-3'>
              <div className='text-muted-foreground text-xs'>Conditions</div>
              <div className='text-xs font-medium'>
                {card.offer.conditions.join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
      <Actions actions={actions} onAction={(a) => onAction?.(a, card)} />
    </BaseCard>
  );
}

function BaseCard({
  typeLabel,
  code,
  title,
  status,
  meta,
  children
}: {
  typeLabel?: string;
  code?: string;
  title: string;
  status?: string;
  meta?: (string | undefined)[];
  children?: React.ReactNode;
}) {
  return (
    <div className='bg-card text-card-foreground w-full max-w-[560px] rounded-xl border p-3.5 shadow-sm sm:p-4'>
      {(typeLabel || code) && (
        <div className='text-muted-foreground mb-1 flex items-center gap-2 text-[11px]'>
          {typeLabel && (
            <span className='tracking-wide uppercase'>{typeLabel}</span>
          )}
          {code && (
            <span className='ml-auto inline-flex items-center gap-1'>
              <span className='opacity-70'>Code</span>
              <span className='text-foreground font-medium'>{code}</span>
            </span>
          )}
        </div>
      )}
      <div className='flex items-center gap-2'>
        <div className='truncate text-[15px] font-semibold'>{title}</div>
        {status && (
          <span
            className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-[11px]',
              statusColor(status)
            )}
          >
            {status}
          </span>
        )}
      </div>
      {meta && meta.filter(Boolean).length > 0 && (
        <div className='text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs'>
          {meta.filter(Boolean).map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-muted/40 rounded p-2'>
      <div className='text-muted-foreground text-[11px]'>{label}</div>
      <div className='truncate font-semibold'>{value}</div>
    </div>
  );
}

function Actions({
  actions,
  onAction
}: {
  actions?: NobleAction[];
  onAction?: (a: NobleAction) => void;
}) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className='mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] gap-2 border-t pt-3'>
      {actions.map((a, i) => (
        <Button
          key={i}
          size='sm'
          variant='secondary'
          className='w-full justify-center'
          onClick={() => onAction?.(a)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function SuiteFileRow({ item }: { item: SuiteFilesCardItem }) {
  const [loading, setLoading] = useState(false);
  const isFolder = item.kind === 'folder';
  const meta: string[] = [];
  if (isFolder) meta.push('Folder');
  else {
    const size = formatBytes(item.size_bytes);
    if (size) meta.push(size);
  }
  if (item.updated_at) meta.push(formatDate(item.updated_at));

  return (
    <div className='bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-2'>
      <div className='bg-background flex size-9 shrink-0 items-center justify-center rounded-md border'>
        {renderSuiteIcon(item)}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>{item.name}</div>
        {meta.length > 0 && (
          <div className='text-muted-foreground text-[11px]'>
            {meta.join(' • ')}
          </div>
        )}
      </div>
      <Button
        variant='secondary'
        size='sm'
        className='shrink-0'
        onClick={() => void handleOpen()}
        disabled={loading}
      >
        {loading && <Loader2 className='mr-2 size-3 animate-spin' />}
        Open
      </Button>
    </div>
  );

  async function handleOpen() {
    if (typeof window === 'undefined') return;
    if (isFolder) {
      const href = `/noblefiles?folder=${item.id}`;
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!item.storage_path) {
      toast.error('File unavailable');
      return;
    }
    setLoading(true);
    try {
      const { data: signed, error } = await supabase.storage
        .from(FILES_BUCKET)
        .createSignedUrl(item.storage_path, 300);
      if (error) throw error;
      const url =
        signed?.signedUrl ||
        supabase.storage.from(FILES_BUCKET).getPublicUrl(item.storage_path).data
          ?.publicUrl;
      if (!url) throw new Error('Link unavailable');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error('Unable to open file', {
        description: e?.message || undefined
      });
    } finally {
      setLoading(false);
    }
  }
}

function renderSuiteIcon(item: SuiteFilesCardItem) {
  if (item.kind === 'folder')
    return <Folder className='size-4 text-blue-500 dark:text-blue-300' />;
  const ext = (item.ext || '').toLowerCase();
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext))
    return <FileText className='size-4 text-purple-500 dark:text-purple-300' />;
  return <FileIcon className='text-muted-foreground size-4' />;
}

function statusColor(s: string) {
  const key = s.toLowerCase();
  if (key.includes('in transit') || key.includes('processing'))
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (key.includes('await') || key.includes('pending'))
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (
    key.includes('delivered') ||
    key.includes('paid') ||
    key.includes('accepted')
  )
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (
    key.includes('rejected') ||
    key.includes('unpaid') ||
    key.includes('hold') ||
    key.includes('issue')
  )
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  return 'bg-muted text-foreground';
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d);
}

function formatBytes(size?: number | null) {
  if (size == null || size < 0) return '';
  if (size === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const precision = value >= 10 || idx === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[idx]}`;
}

// (no-op)

// (unused)
