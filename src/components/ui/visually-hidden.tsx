'use client';

import React, { isValidElement, cloneElement } from 'react';

type Props = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
  children: React.ReactNode;
};

export function VisuallyHidden({
  asChild,
  children,
  className,
  ...props
}: Props) {
  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    const mergedClassName = [child.props?.className, 'sr-only', className]
      .filter(Boolean)
      .join(' ');
    return cloneElement(child, {
      ...(props as Record<string, unknown>),
      className: mergedClassName
    });
  }
  return (
    <span
      className={['sr-only', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}
