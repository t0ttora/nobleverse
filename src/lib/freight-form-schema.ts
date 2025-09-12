import freightFormSchema from './freight_form_schema.json';

export type FreightFormType = keyof typeof freightFormSchema.forms;
export type FreightFormConfig =
  (typeof freightFormSchema.forms)[FreightFormType];
export type FreightFormSection = FreightFormConfig['sections'][number];
export type FreightFormField = FreightFormSection['fields'][number];
export type FreightFormNotesSection = FreightFormConfig['notes_section'];

export function getFormConfig(type: string): FreightFormConfig | null {
  return (freightFormSchema.forms as any)[type] || null;
}
