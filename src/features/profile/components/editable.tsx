'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type EditableTextProps = {
  value: string;
  placeholder?: string;
  className?: string;
  onSave: (val: string) => Promise<void> | void;
  as?: 'input' | 'span';
  type?: 'text' | 'url' | 'tel' | 'email';
};

export function EditableText({
  value,
  placeholder,
  className,
  onSave,
  as = 'input',
  type = 'text'
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setVal(value || ''), [value]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if ((val || '') !== (value || '')) await onSave(val.trim());
  };

  if (!editing) {
    return (
      <span
        className={cn(
          'cursor-text underline-offset-4 hover:underline',
          className
        )}
        onClick={() => setEditing(true)}
      >
        {val || (
          <span className='text-muted-foreground'>{placeholder || '—'}</span>
        )}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      className={cn(
        'border-primary/40 focus:border-primary border-b bg-transparent text-sm transition outline-none',
        className
      )}
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setEditing(false);
          setVal(value || '');
        }
      }}
    />
  );
}

type EditableTextareaProps = {
  value: string;
  placeholder?: string;
  className?: string;
  onSave: (val: string) => Promise<void> | void;
  rows?: number;
};

export function EditableTextarea({
  value,
  placeholder,
  className,
  onSave,
  rows = 3
}: EditableTextareaProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setVal(value || ''), [value]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if ((val || '') !== (value || '')) await onSave(val.trim());
  };

  if (!editing) {
    return (
      <p
        className={cn(
          'hover:bg-accent/20 text-foreground/80 cursor-text rounded p-1 text-sm whitespace-pre-line',
          className
        )}
        onClick={() => setEditing(true)}
      >
        {val || (
          <span className='text-muted-foreground'>{placeholder || '—'}</span>
        )}
      </p>
    );
  }

  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'bg-background w-full rounded border p-2 text-sm',
        className
      )}
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setEditing(false);
          setVal(value || '');
        }
      }}
    />
  );
}
