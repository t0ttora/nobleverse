export default function NobleSuiteNotesPage() {
  return (
    <div className='flex flex-col gap-4 p-6'>
      <h2 className='text-base font-semibold'>Notes</h2>
      <p className='text-muted-foreground max-w-prose text-xs'>
        Rich text editor placeholder. Plan: Tiptap, realtime, templates, export.
      </p>
      <div className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-xs'>
        Coming soon – collaborative notes editor.
      </div>
    </div>
  );
}
