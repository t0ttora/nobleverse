'use client';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input as TextInput } from '@/components/ui/input';
import type { Presence } from '@/lib/contacts';
import type { Role } from '@/types/profile';

const allRoles: Role[] = ['shipper', 'forwarder', 'carrier', 'broker', 'other'];

export interface FiltersBarProps {
  value: {
    search: string;
    roles: Role[];
    presences?: Presence[];
    sort?: 'name' | 'last_active';
    tag?: string;
    department?: string;
  };
  onChange: (v: FiltersBarProps['value']) => void;
  rightSlot?: React.ReactNode;
}

export function FiltersBar({ value, onChange, rightSlot }: FiltersBarProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <Input
        placeholder='Search people...'
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        className='w-full sm:max-w-sm'
      />
      <div className='flex items-center gap-2'>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant='outline'>Filters</Button>
          </PopoverTrigger>
          <PopoverContent align='end' className='w-72'>
            <div className='mb-2 text-sm font-medium'>Roles</div>
            <div className='mb-3 space-y-2'>
              {allRoles.map((r) => {
                const checked = value.roles.includes(r);
                return (
                  <label key={r} className='flex items-center gap-2 text-sm'>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const roles = c
                          ? [...value.roles, r]
                          : value.roles.filter((x) => x !== r);
                        onChange({ ...value, roles });
                      }}
                    />
                    <span className='capitalize'>{r}</span>
                  </label>
                );
              })}
            </div>
            <div className='mb-2 text-sm font-medium'>Presence</div>
            <div className='mb-3 space-y-2'>
              {(['online', 'dnd', 'offline'] as Presence[]).map((p) => {
                const checked = (value.presences || []).includes(p);
                return (
                  <label key={p} className='flex items-center gap-2 text-sm'>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const cur = value.presences || [];
                        const presences = c
                          ? [...cur, p]
                          : cur.filter((x) => x !== p);
                        onChange({ ...value, presences });
                      }}
                    />
                    <span className='text-xs uppercase'>{p}</span>
                  </label>
                );
              })}
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div>
                <div className='mb-1 text-sm font-medium'>Tag</div>
                <TextInput
                  placeholder='e.g. finance'
                  value={value.tag || ''}
                  onChange={(e) => onChange({ ...value, tag: e.target.value })}
                  className='h-8'
                />
              </div>
              <div>
                <div className='mb-1 text-sm font-medium'>Department</div>
                <TextInput
                  placeholder='e.g. ops'
                  value={value.department || ''}
                  onChange={(e) =>
                    onChange({ ...value, department: e.target.value })
                  }
                  className='h-8'
                />
              </div>
            </div>
            <div className='mt-3'>
              <div className='mb-1 text-sm font-medium'>Sort</div>
              <Select
                value={value.sort || 'name'}
                onValueChange={(v) => onChange({ ...value, sort: v as any })}
              >
                <SelectTrigger className='h-8'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='name'>Name</SelectItem>
                  <SelectItem value='last_active'>Last Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
        {rightSlot}
      </div>
    </div>
  );
}
