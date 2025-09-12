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
import type { Role } from '@/types/profile';

const allRoles: Role[] = ['shipper', 'forwarder', 'carrier', 'broker', 'other'];

export interface FiltersBarProps {
  value: { search: string; roles: Role[] };
  onChange: (v: { search: string; roles: Role[] }) => void;
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
          <PopoverContent align='end' className='w-60'>
            <div className='mb-2 text-sm font-medium'>Roles</div>
            <div className='space-y-2'>
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
          </PopoverContent>
        </Popover>
        {rightSlot}
      </div>
    </div>
  );
}
