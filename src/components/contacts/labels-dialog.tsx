'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem
} from '@/components/ui/command';

export type LabelsDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'single' | 'bulk';
  title?: string;
  initialTags: string[];
  initialDepartments: string[];
  tagSuggestions: string[];
  departmentSuggestions: string[];
  onSave: (opts: {
    tags: string[];
    departments: string[];
  }) => Promise<void> | void;
};

export function LabelsDialog({
  open,
  onOpenChange,
  mode,
  title,
  initialTags,
  initialDepartments,
  tagSuggestions,
  departmentSuggestions,
  onSave
}: LabelsDialogProps) {
  const [tags, setTags] = React.useState<string[]>(initialTags);
  const [deps, setDeps] = React.useState<string[]>(initialDepartments);
  const [tagQuery, setTagQuery] = React.useState('');
  const [depQuery, setDepQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTags(initialTags);
      setDeps(initialDepartments);
      setTagQuery('');
      setDepQuery('');
    }
  }, [open, initialTags, initialDepartments]);

  function add(list: string[], setList: (v: string[]) => void, value: string) {
    const v = value.trim();
    if (!v) return;
    if (list.includes(v)) return;
    setList([...list, v]);
  }
  function remove(
    list: string[],
    setList: (v: string[]) => void,
    value: string
  ) {
    setList(list.filter((x) => x !== value));
  }

  async function save() {
    setBusy(true);
    try {
      await onSave({ tags, departments: deps });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[640px]'>
        <DialogHeader>
          <DialogTitle>
            {title ||
              (mode === 'bulk' ? 'Edit labels for selected' : 'Edit labels')}
          </DialogTitle>
          <DialogDescription>
            Add or remove tags and departments. Suggestions update as you type.
          </DialogDescription>
        </DialogHeader>
        <div className='grid grid-cols-1 gap-6 sm:grid-cols-2'>
          <div>
            <div className='mb-1 text-xs font-semibold'>Tags</div>
            <div className='flex min-h-10 flex-wrap items-center gap-1 rounded border px-2 py-1'>
              {tags.map((t) => (
                <Chip
                  key={t}
                  text={t}
                  onRemove={() => remove(tags, setTags, t)}
                />
              ))}
              <input
                className='min-w-[120px] flex-1 text-sm outline-none'
                placeholder='Add tag…'
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add(tags, setTags, tagQuery);
                    setTagQuery('');
                  }
                }}
              />
            </div>
            <div className='mt-2 rounded border'>
              <Command>
                <CommandInput
                  value={tagQuery}
                  onValueChange={setTagQuery}
                  placeholder='Search tags…'
                />
                <CommandList>
                  <CommandEmpty>No matches.</CommandEmpty>
                  <CommandGroup heading='Suggestions'>
                    {tagSuggestions
                      .filter((s) =>
                        s.toLowerCase().includes(tagQuery.trim().toLowerCase())
                      )
                      .slice(0, 10)
                      .map((s) => (
                        <CommandItem
                          key={s}
                          value={s}
                          onSelect={() => {
                            add(tags, setTags, s);
                            setTagQuery('');
                          }}
                        >
                          {s}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>
          <div>
            <div className='mb-1 text-xs font-semibold'>Departments</div>
            <div className='flex min-h-10 flex-wrap items-center gap-1 rounded border px-2 py-1'>
              {deps.map((d) => (
                <Chip
                  key={d}
                  text={d}
                  onRemove={() => remove(deps, setDeps, d)}
                />
              ))}
              <input
                className='min-w-[120px] flex-1 text-sm outline-none'
                placeholder='Add department…'
                value={depQuery}
                onChange={(e) => setDepQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add(deps, setDeps, depQuery);
                    setDepQuery('');
                  }
                }}
              />
            </div>
            <div className='mt-2 rounded border'>
              <Command>
                <CommandInput
                  value={depQuery}
                  onValueChange={setDepQuery}
                  placeholder='Search departments…'
                />
                <CommandList>
                  <CommandEmpty>No matches.</CommandEmpty>
                  <CommandGroup heading='Suggestions'>
                    {departmentSuggestions
                      .filter((s) =>
                        s.toLowerCase().includes(depQuery.trim().toLowerCase())
                      )
                      .slice(0, 10)
                      .map((s) => (
                        <CommandItem
                          key={s}
                          value={s}
                          onSelect={() => {
                            add(deps, setDeps, s);
                            setDepQuery('');
                          }}
                        >
                          {s}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>
        </div>
        <div className='flex items-center justify-end gap-2 pt-2'>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span className='bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs'>
      {text}
      <button onClick={onRemove} className='opacity-60 hover:opacity-100'>
        ×
      </button>
    </span>
  );
}
