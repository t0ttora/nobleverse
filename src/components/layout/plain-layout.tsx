import React from 'react';

export default function PlainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='bg-background flex min-h-screen w-full flex-col'>
      {children}
    </div>
  );
}
