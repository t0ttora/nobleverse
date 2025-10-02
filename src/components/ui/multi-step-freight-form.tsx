import { toast } from 'sonner';
import React from 'react';
import type {
  FreightFormType,
  FreightFormField
} from '@/lib/freight-form-schema';
import { getFormConfig } from '@/lib/freight-form-schema';
import { Button } from '@/components/ui/button';
import { createRequest } from '../../../utils/supabase/requests';
import { createShipment } from '../../../utils/supabase/shipments';
import { supabase } from '../../../utils/supabase/client';
// Popover kaldırıldı

interface MultiStepFreightFormProps {
  type?: FreightFormType; // optional when allowTypeSelection is true
  userId: string;
  onSuccess?: (entity: any) => void;
  mode?: 'request' | 'booking';
  allowTypeSelection?: boolean;
  onTypeChange?: (t: FreightFormType) => void;
  // Called whenever footer action JSX should update; parent places it into SidePanel footer.
  onFooterChange?: (footer: React.ReactNode) => void;
}

export const MultiStepFreightForm: React.FC<MultiStepFreightFormProps> = ({
  type,
  userId,
  onSuccess,
  mode = 'request',
  allowTypeSelection = false,
  onTypeChange,
  onFooterChange
}) => {
  const [currentType, setCurrentType] = React.useState<
    FreightFormType | undefined
  >(type);
  React.useEffect(() => {
    if (type && type !== currentType) setCurrentType(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const formConfig = currentType ? getFormConfig(currentType) : null;
  const [step, setStep] = React.useState(0);
  const [formData, setFormData] = React.useState<any>({});
  const [preview, setPreview] = React.useState(false);
  const [status, setStatus] = React.useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [additionalNotes, setAdditionalNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  // MAS (must be as specified) fields state must be declared before any early return to satisfy hooks rules
  const [masChecked, setMasChecked] = React.useState<{
    [key: string]: boolean;
  }>({});

  // Freight type selection (when enabled)
  const FREIGHT_TYPES: { value: FreightFormType; label: string }[] = [
    { value: 'road', label: 'Road Freight' },
    { value: 'sea', label: 'Sea Freight' },
    { value: 'air', label: 'Air Freight' },
    { value: 'rail', label: 'Rail Freight' },
    { value: 'multimodal', label: 'Multimodal Freight' },
    { value: 'courier', label: 'Courier / Express Shipping' }
  ];

  if (!formConfig) {
    if (allowTypeSelection) {
      return (
        <div className='flex min-h-[40vh] flex-col items-center justify-center gap-4'>
          <div className='text-base font-medium'>Select freight type</div>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {FREIGHT_TYPES.map((t) => (
              <button
                key={t.value}
                className='hover:bg-accent/60 flex items-center justify-center rounded-md border px-4 py-2 text-sm shadow-sm transition-colors'
                onClick={() => {
                  setCurrentType(t.value);
                  onTypeChange?.(t.value);
                }}
                type='button'
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return <div className='text-red-500'>Form config not found.</div>;
  }

  const sections = formConfig.sections;
  const currentSection = sections[step];
  const isLastStep = step === sections.length - 1;
  const isFirstStep = step === 0;

  const handleChange = (field: FreightFormField, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field.id]: value }));
  };

  const handleNext = React.useCallback(() => {
    if (!isLastStep) setStep((s) => s + 1);
    else setPreview(true);
  }, [isLastStep]);

  const handleBack = React.useCallback(() => {
    if (preview) setPreview(false);
    else if (!isFirstStep) setStep((s) => s - 1);
  }, [preview, isFirstStep]);

  const handleSubmit = async (asDraft = false) => {
    setStatus('submitting');
    setError(null);
    try {
      // details alanı: formData + masChecked + additionalNotes + draft
      const details = {
        ...formData,
        mas: masChecked,
        additionalNotes,
        draft: asDraft
      };
      // Create Request or Shipment depending on mode
      if (mode === 'booking') {
        if (!currentType)
          throw new Error('Freight type is required to create a booking');
        const shipment = await createShipment({
          supabase,
          ownerId: userId,
          forwarderId: null,
          freightType: currentType,
          details
        });
        setStatus('success');
        toast.success('Booking created as shipment!');
        onSuccess?.(shipment);
      } else {
        if (!currentType)
          throw new Error('Freight type is required to create a request');
        const request = await createRequest({
          supabase,
          freightType: currentType,
          details,
          userId
        });
        setStatus('success');
        toast.success('Request submitted successfully!');
        onSuccess?.(request);
      }
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || 'An error occurred.');
      toast.error(`Failed to submit request: ${e?.message || 'Unknown error'}`);
    }
  };

  const masFields = sections.flatMap((section) =>
    section.fields.filter((f) => f.mas)
  );
  const handleMasChange = (id: string, checked: boolean) => {
    setMasChecked((prev) => ({ ...prev, [id]: checked }));
  };

  if (status === 'success' || status === 'error') {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        {status === 'success' ? (
          <span className='mb-2 text-2xl font-semibold text-green-600'>
            Success
          </span>
        ) : (
          <span className='mb-2 text-2xl font-semibold text-red-600'>
            Failed: {error}
          </span>
        )}
        <Button
          variant='outline'
          onClick={() => {
            setStep(0);
            setFormData({});
            setStatus('idle');
            setPreview(false);
            setMasChecked({});
            setAdditionalNotes('');
            setError(null);
          }}
        >
          New Form
        </Button>
      </div>
    );
  }

  // Stepper UI
  const Stepper = () => (
    <div className='mb-8 flex items-center justify-center gap-0'>
      {sections.map((section, idx) => (
        <React.Fragment key={section.title}>
          <div className='flex min-w-[80px] flex-col items-center'>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-base font-bold shadow-sm transition-all duration-200 ${idx === step ? 'bg-primary border-primary scale-110 text-white' : idx < step ? 'border-green-500 bg-green-500 text-white' : 'border-neutral-300 bg-neutral-100 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800'}`}
            >
              {idx + 1}
            </div>
            <span
              className={`mt-2 max-w-[80px] text-center text-xs font-medium ${idx === step ? 'text-primary' : 'text-neutral-400 dark:text-neutral-500'}`}
            >
              {section.title}
            </span>
          </div>
          {idx < sections.length - 1 && (
            <div className='from-primary/30 to-primary/30 mx-2 h-0.5 flex-1 bg-gradient-to-r via-neutral-300 dark:via-neutral-700' />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // Field rendering by type
  const renderField = (field: FreightFormField) => {
    if (field.type === 'boolean') {
      return (
        <div className='mt-1 flex gap-4'>
          <label className='inline-flex cursor-pointer items-center gap-1 select-none'>
            <input
              type='radio'
              name={field.id}
              checked={formData[field.id] === true}
              onChange={() => handleChange(field, true)}
              className='accent-primary'
            />
            <span>Yes</span>
          </label>
          <label className='inline-flex cursor-pointer items-center gap-1 select-none'>
            <input
              type='radio'
              name={field.id}
              checked={formData[field.id] === false}
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
        <input
          id={field.id}
          type='number'
          className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 transition-all focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
          value={formData[field.id] || ''}
          onChange={(e) =>
            handleChange(
              field,
              e.target.value === '' ? '' : Number(e.target.value)
            )
          }
        />
      );
    }
    if (field.type === 'select' && Array.isArray((field as any).options)) {
      return (
        <select
          id={field.id}
          className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 transition-all focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
          value={formData[field.id] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
        >
          <option value=''>Select...</option>
          {((field as any).options as string[]).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'date') {
      return (
        <input
          id={field.id}
          type='date'
          className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 transition-all focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
          value={formData[field.id] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
        />
      );
    }
    if (field.type === 'textarea') {
      return (
        <textarea
          id={field.id}
          className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 transition-all focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
          value={formData[field.id] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          rows={3}
        />
      );
    }
    // default: text
    return (
      <input
        id={field.id}
        type='text'
        className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 transition-all focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
        value={formData[field.id] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
      />
    );
  };

  // Footer element memo & change detection to avoid infinite render loop
  const footerElement = React.useMemo(() => {
    if (preview) {
      return (
        <>
          <Button variant='outline' onClick={handleBack}>
            Back
          </Button>
          <Button
            type='button'
            variant='secondary'
            onClick={() => handleSubmit(true)}
            disabled={status === 'submitting'}
          >
            Submit as draft
          </Button>
          <Button
            type='button'
            onClick={() => handleSubmit(false)}
            disabled={status === 'submitting'}
          >
            Submit
          </Button>
        </>
      );
    }
    return (
      <>
        <Button
          variant='outline'
          type='button'
          onClick={handleBack}
          disabled={isFirstStep && !preview}
        >
          Back
        </Button>
        <Button type='button' onClick={handleNext}>
          {isLastStep ? 'Preview' : 'Next'}
        </Button>
      </>
    );
  }, [preview, isFirstStep, isLastStep, status, handleBack]);

  const lastFooterRef = React.useRef<React.ReactNode>(null);
  React.useEffect(() => {
    if (lastFooterRef.current !== footerElement) {
      lastFooterRef.current = footerElement;
      onFooterChange?.(footerElement);
    }
  }, [footerElement, onFooterChange]);

  if (preview) {
    return (
      <div className='flex min-h-[60vh] flex-col'>
        <div className='flex-1 space-y-6 overflow-y-auto pr-1'>
          <h3 className='mb-2 text-lg font-semibold'>Preview</h3>
          <div className='rounded-xl bg-neutral-100 p-4 text-sm dark:bg-neutral-800'>
            {sections.map((section, idx) => (
              <div key={section.title} className='mb-4'>
                <div className='mb-1 font-medium'>{section.title}</div>
                <ul className='ml-4 list-disc'>
                  {section.fields.map((field) => (
                    <li key={field.id} className='flex items-center gap-2'>
                      <span className='font-semibold'>{field.label}:</span>{' '}
                      {formData[field.id] !== undefined &&
                      formData[field.id] !== '' ? (
                        String(formData[field.id])
                      ) : (
                        <span className='text-neutral-400'>(empty)</span>
                      )}
                      {field.mas && (
                        <span className='ml-2 inline-flex items-center gap-1 text-xs'>
                          <input
                            type='checkbox'
                            checked={!!masChecked[field.id]}
                            onChange={(e) =>
                              handleMasChange(field.id, e.target.checked)
                            }
                            className='accent-primary rounded'
                          />
                          <span className='text-primary'>
                            Must be as specified
                          </span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {/* Additional Notes textarea */}
            <div className='mt-6'>
              <label
                htmlFor='additionalNotes'
                className='mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-200'
              >
                Additional Notes
              </label>
              <textarea
                id='additionalNotes'
                className='focus:ring-primary min-h-[80px] w-full rounded-md border border-neutral-300 bg-white px-3 py-2 transition-all focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder='Add any extra information here...'
                rows={4}
              />
            </div>
          </div>
          {masFields.length > 0 && (
            <div className='bg-primary/10 border-primary/20 text-primary mb-2 rounded-xl border p-3 text-xs'>
              <span className='font-semibold'>Note:</span> You can mark fields
              as <span className='font-bold'>Must be as specified</span> (MAS)
              for your request. This will be visible to potential providers.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      className='flex min-h-[60vh] flex-col'
      onSubmit={(e) => {
        e.preventDefault();
        handleNext();
      }}
    >
      {allowTypeSelection && (
        <div className='mb-4 flex flex-wrap items-center gap-2'>
          <label className='text-sm font-medium'>Freight Type</label>
          <select
            className='focus:ring-primary rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900'
            value={currentType || ''}
            onChange={(e) => {
              const v = e.target.value as FreightFormType;
              setCurrentType(v);
              onTypeChange?.(v);
            }}
          >
            <option value='' disabled>
              Select type...
            </option>
            {FREIGHT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <Stepper />
      <div className='flex-1 overflow-y-auto px-1'>
        <div className='mb-2 text-base font-semibold'>
          {currentSection.title}
        </div>
        <div className='space-y-4'>
          {/* First step: file upload placeholder */}
          {isFirstStep && (
            <div className='mb-2 flex flex-col gap-1 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-4 text-center dark:border-neutral-700 dark:bg-neutral-900'>
              <span className='mb-2 text-neutral-500 dark:text-neutral-400'>
                File upload coming soon
              </span>
              <Button variant='outline' type='button' disabled>
                Upload File
              </Button>
              <span className='mt-2 text-xs text-neutral-400'>
                Or fill the form manually below
              </span>
            </div>
          )}
          {currentSection.fields.map((field) => (
            <div key={field.id} className='mb-[10px] flex flex-col gap-1'>
              <label
                htmlFor={field.id}
                className='text-sm font-medium text-neutral-700 dark:text-neutral-200'
              >
                {field.label}
                {field.required && <span className='ml-1 text-red-500'>*</span>}
              </label>
              {renderField(field)}
            </div>
          ))}
        </div>
        {/* Hata mesajı */}
        {error && <div className='mt-2 text-sm text-red-500'>{error}</div>}
      </div>
      {/* Footer removed: actions now provided via onFooterChange -> SidePanel footer */}
    </form>
  );

  // ...dosya sonu temizlendi...
};
