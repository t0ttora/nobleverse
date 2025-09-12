'use client';
import React from 'react';

interface FileUploaderProps {
  value?: FileList | File[] | null;
  onValueChange?: (files: FileList | File[] | null) => void;
  maxFiles?: number;
  maxSize?: number; // bytes
  accept?: string;
  disabled?: boolean;
}

export function FileUploader({
  value,
  onValueChange,
  maxFiles = 4,
  maxSize = 4 * 1024 * 1024,
  accept = 'image/*',
  disabled
}: FileUploaderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return onValueChange?.(null);
    // Basic client-side constraints
    const arr = Array.from(files)
      .slice(0, maxFiles)
      .filter((f) => f.size <= maxSize);
    onValueChange?.(arr);
  };

  return (
    <div className='flex flex-col gap-2'>
      <input
        type='file'
        accept={accept}
        multiple={maxFiles > 1}
        onChange={handleChange}
        disabled={disabled}
        className='text-foreground file:border-input file:bg-muted file:text-foreground hover:file:bg-muted/80 block w-full text-sm file:mr-4 file:rounded-md file:border file:px-3 file:py-1.5'
      />
      {Array.isArray(value) && value.length > 0 && (
        <ul className='text-muted-foreground list-disc pl-5 text-xs'>
          {value.map((f, i) => (
            <li key={i}>
              {f.name} – {Math.round((f.size ?? 0) / 1024)} KB
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FileUploader;
