import type { ReactNode } from 'react';

// Segment layout for /noblesuite
// Keep it minimal for now; inherit global shell from RootLayout.
export default function NobleSuiteLayout({
  children
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
