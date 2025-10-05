'use client';
import React, { forwardRef, useImperativeHandle } from 'react';
import { SidePanel } from '@/components/ui/side-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getOfferConfig, type OfferField } from '@/lib/forwarder-offer-schema';
import { supabase } from '@/lib/supabaseClient';
import { createOffer, updateOffer } from '../../../utils/supabase/offers';
import { toast } from 'sonner';

export interface ForwarderOfferFormProps {
  // When embedded, we render content only (no SidePanel wrapper)
  embedded?: boolean;
  open?: boolean; // used only when not embedded
  onClose?: () => void; // used only when not embedded
  onCancel?: () => void; // used in embedded mode to exit
  requestId: string;
  forwarderId?: string;
  requestDetails?: Record<string, any>;
  onSubmitted?: () => void;
  // When true, hide internal footer and let parent render controls
  useExternalFooter?: boolean;
  // Optional notifier so parent can mirror step/submitting/valid state
  onStateChange?: (state: {
    isFirst: boolean;
    isLast: boolean;
    submitting: boolean;
    step: number;
    currentValid: boolean;
  }) => void;
  // Optional: owner id for notifications on create
  ownerId?: string;
  // Optional: existing offer for edit
  existingOffer?: { id: string; details: any } | null;
  onFooterChange?: (footer: React.ReactNode) => void; // new: expose actions
}

export type ForwarderOfferFormHandle = {
  next: () => void;
  back: () => void;
  submit: () => Promise<void>;
  getState: () => {
    isFirst: boolean;
    isLast: boolean;
    submitting: boolean;
    step: number;
    currentValid: boolean;
  };
  isCurrentStepValid: () => boolean;
};

export const ForwarderOfferForm = forwardRef<
  ForwarderOfferFormHandle,
  ForwarderOfferFormProps
>(function ForwarderOfferForm(
  {
    embedded,
    open = false,
    onClose,
    onCancel,
    requestId,
    forwarderId,
    requestDetails,
    onSubmitted,
    onStateChange,
    ownerId,
    existingOffer,
    onFooterChange
  }: ForwarderOfferFormProps,
  ref
) {
  const config = getOfferConfig();
  const sections = config.sections;
  const [step, setStep] = React.useState(0);
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  // ---
  // Robust field change handler (like MultiStepFreightForm)
  const handleChange = (field: OfferField, value: any) => {
    setFormData((prev) => ({ ...prev, [field.id]: value }));
  };
  const [submitting, setSubmitting] = React.useState(false);

  // Reset on panel close (non-embedded)
  React.useEffect(() => {
    if (!embedded && !open) {
      setStep(0);
      setFormData({});
      setSubmitting(false);
    }
  }, [embedded, open]);

  // Only prefill when modal is first opened, not on every prop change
  React.useEffect(() => {
    if (!embedded && open && !existingOffer && requestDetails) {
      setFormData((prev) => {
        const d = requestDetails || {};
        return {
          ...prev,
          total_price: d.budget ?? prev.total_price ?? '',
          free_time: d.free_time_days ?? prev.free_time ?? '',
          payment_terms: d.payment_terms ?? prev.payment_terms ?? '',
          currency: prev.currency || 'USD',
          total_price_currency: prev.total_price_currency || 'USD'
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, open]);

  // When editing, prefill from existing offer details only when modal is opened and offer changes
  React.useEffect(() => {
    if (embedded || !open) return;
    if (
      existingOffer?.details !== undefined &&
      existingOffer?.details !== null
    ) {
      let d: any = existingOffer.details as any;
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d);
        } catch {
          d = {};
        }
      }
      setFormData((prev) => ({
        ...prev,
        ...d,
        currency: d.currency || prev.currency || 'USD',
        total_price_currency:
          d.total_price_currency || prev.total_price_currency || 'USD'
      }));
    }
  }, [embedded, open, existingOffer?.id, existingOffer?.details]);

  const current = sections[step];
  const isLast = step === sections.length - 1;
  const isFirst = step === 0;

  function isEmpty(v: any) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }

  function isCurrentStepValidInternal(): boolean {
    if (!current) return true;
    // required field checks
    for (const f of current.fields as OfferField[]) {
      if (f.required) {
        const val = (formData as any)[f.id];
        if (isEmpty(val)) return false;
        if (f.type === 'number') {
          // During typing, numbers are kept as strings; validate parsable number when non-empty
          if (val !== '') {
            const parsed = Number(String(val).replace(',', '.'));
            if (Number.isNaN(parsed)) return false;
          }
        }
      }
    }
    // business rules
    const budget = Number(
      String(requestDetails?.budget ?? '').replace(',', '.')
    );
    const price = Number(
      String((formData as any).total_price ?? '').replace(',', '.')
    );
    if (!isNaN(price) && price < 0) return false;
    if (!isNaN(budget) && !isNaN(price) && price > budget) return false;
    return true;
  }

  const notifyState = React.useCallback(() => {
    onStateChange?.({
      isFirst,
      isLast,
      submitting,
      step,
      currentValid: isCurrentStepValidInternal()
    });
  }, [
    onStateChange,
    isFirst,
    isLast,
    submitting,
    step,
    formData,
    requestDetails
  ]);

  React.useEffect(() => {
    notifyState();
  }, [notifyState]);

  // ---
  // Render field by type (like MultiStepFreightForm)
  function renderField(field: OfferField) {
    const val = formData[field.id];
    if (field.type === 'boolean') {
      return (
        <div className='mt-1 flex gap-4'>
          <label className='inline-flex cursor-pointer items-center gap-1 select-none'>
            <input
              type='radio'
              name={field.id}
              checked={val === true}
              onChange={() => handleChange(field, true)}
              className='accent-primary'
            />
            <span>Yes</span>
          </label>
          <label className='inline-flex cursor-pointer items-center gap-1 select-none'>
            <input
              type='radio'
              name={field.id}
              checked={val === false}
              onChange={() => handleChange(field, false)}
              className='accent-primary'
            />
            <span>No</span>
          </label>
        </div>
      );
    }
    if (field.type === 'number') {
      return (
        <Input
          id={field.id}
          type='number'
          className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
          value={val ?? ''}
          onChange={(e) => handleChange(field, e.target.value)}
        />
      );
    }
    if (field.type === 'select' && Array.isArray(field.options)) {
      return (
        <select
          id={field.id}
          className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
          value={val ?? ''}
          onChange={(e) => handleChange(field, e.target.value)}
        >
          <option value=''>Select...</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'multiselect') {
      const selected: string[] = Array.isArray(val) ? val : [];
      return (
        <div className='flex flex-wrap gap-1'>
          {(field.options || []).map((o) => {
            const isOn = selected.includes(o);
            return (
              <button
                type='button'
                key={o}
                onClick={() => {
                  const next = isOn
                    ? selected.filter((x) => x !== o)
                    : [...selected, o];
                  handleChange(field, next);
                }}
                className={`rounded border px-2 py-1 text-xs ${isOn ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'}`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    // default: text
    return (
      <input
        id={field.id}
        type='text'
        className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
        value={val ?? ''}
        onChange={(e) => handleChange(field, e.target.value)}
      />
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const budget = Number(
        String(requestDetails?.budget ?? '').replace(',', '.')
      );
      const price = Number(
        String((formData as any).total_price ?? '').replace(',', '.')
      );
      if (isNaN(price) || price < 0) {
        setSubmitting(false);
        toast.error('Total Offer Price must be a non-negative number.');
        return;
      }
      if (!isNaN(budget) && price > budget) {
        setSubmitting(false);
        toast.error('Total Offer Price cannot exceed the request budget.');
        return;
      }
      // Normalize numeric fields to numbers on submit
      const normalized: Record<string, any> = { ...formData };
      for (const sec of sections) {
        for (const f of sec.fields as OfferField[]) {
          if (f.type === 'number') {
            const v = (normalized as any)[f.id];
            if (v !== '' && v !== undefined && v !== null) {
              const n = Number(String(v).replace(',', '.'));
              (normalized as any)[f.id] = Number.isNaN(n) ? v : n;
            }
          }
        }
      }
      const details: Record<string, any> = {
        ...normalized,
        currency: 'USD',
        total_price_currency: 'USD'
      };
      if (existingOffer?.id) {
        await updateOffer(supabase as any, {
          offerId: existingOffer.id,
          details
        });
        toast.success('Offer updated');
      } else {
        const created = await createOffer(supabase as any, {
          requestId,
          forwarderId: forwarderId || '',
          details
        });
        // Notify request owner
        if (ownerId && ownerId !== (forwarderId || '')) {
          try {
            const title = 'New offer received';
            await (supabase as any).from('notifications').insert({
              user_id: ownerId,
              actor_id: forwarderId || null,
              type: 'offer_created',
              title,
              category: 'inbox',
              data: {
                kind: 'offer_created',
                request_id: requestId,
                offer_id: created.id,
                total_price: (details as any).total_price
              }
            });
          } catch {}
        }
        toast.success('Offer sent');
      }
      onSubmitted?.();
      if (!embedded) onClose?.();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send offer');
    } finally {
      setSubmitting(false);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      next: () => {
        if (isLast) return;
        if (!isCurrentStepValidInternal()) return;
        setStep((s) => Math.min(sections.length - 1, s + 1));
      },
      back: () => {
        setStep((s) => Math.max(0, s - 1));
      },
      submit: handleSubmit,
      getState: () => ({
        isFirst,
        isLast,
        submitting,
        step,
        currentValid: isCurrentStepValidInternal()
      }),
      isCurrentStepValid: isCurrentStepValidInternal
    }),
    [
      isFirst,
      isLast,
      submitting,
      step,
      sections.length,
      formData,
      requestDetails,
      handleSubmit
    ]
  );

  // Build footer actions (internal or external consumer)
  const buildFooter = React.useCallback(() => {
    return (
      <>
        <Button
          type='button'
          variant='outline'
          onClick={() =>
            step > 0
              ? setStep((s) => s - 1)
              : embedded
                ? onCancel?.()
                : onClose?.()
          }
        >
          Back
        </Button>
        {!isLast ? (
          <Button
            type='button'
            onClick={() =>
              isCurrentStepValidInternal() && setStep((s) => s + 1)
            }
          >
            Next
          </Button>
        ) : (
          <Button type='button' onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Offer'}
          </Button>
        )}
      </>
    );
  }, [
    step,
    isLast,
    embedded,
    submitting,
    onCancel,
    onClose,
    isCurrentStepValidInternal
  ]);

  React.useEffect(() => {
    onFooterChange?.(buildFooter());
  }, [buildFooter, onFooterChange]);

  const Content = (
    <form
      className='flex min-h-[60vh] flex-col'
      onSubmit={(e) => e.preventDefault()}
      autoComplete='off'
    >
      {/* Stepper */}
      <div className='mb-6 flex items-center justify-center gap-0'>
        {sections.map((s, i) => (
          <React.Fragment key={s.title}>
            <div className='flex min-w-[80px] flex-col items-center'>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${i === step ? 'bg-primary border-primary text-white' : i < step ? 'border-green-500 bg-green-500 text-white' : 'border-neutral-300 bg-neutral-100 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800'}`}
              >
                {i + 1}
              </div>
              <span>{s.title}</span>
            </div>
            {i < sections.length - 1 && (
              <div className='from-primary/30 to-primary/30 mx-2 h-0.5 flex-1 bg-gradient-to-r via-neutral-300 dark:via-neutral-700' />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Fields */}
      <div
        className='flex-1 overflow-y-auto pr-1 pl-1'
        style={{ marginBottom: 90 }}
      >
        <div className='mb-2 text-base font-semibold'>{current?.title}</div>
        <div className='space-y-3'>
          {(current?.fields || []).map((f) => (
            <div key={(f as OfferField).id} className='flex flex-col gap-1'>
              <label
                htmlFor={(f as OfferField).id}
                className='text-sm font-medium'
              >
                {(f as OfferField).label}
                {(f as OfferField).required && (
                  <span className='ml-1 text-red-500'>*</span>
                )}
              </label>
              {renderField(f as OfferField)}
            </div>
          ))}
        </div>
      </div>

      {/* Footer removed; now provided externally via onFooterChange */}
    </form>
  );

  if (embedded) return Content;
  return (
    <SidePanel
      open={open!}
      onClose={onClose!}
      title={<span className='font-semibold'>Create Offer</span>}
      footer={buildFooter()}
    >
      {Content}
    </SidePanel>
  );
});
