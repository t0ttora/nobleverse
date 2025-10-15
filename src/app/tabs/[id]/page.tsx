'use client';
import { useParams } from 'next/navigation';
import TabContentHost from '@/components/layout/tab-content-host';

export default function TabIdPlaceholderPage() {
  // Keep it super light: just render the host overlay; it already picks the active tab
  // The route param is available for future deep-linking if needed.
  const _params = useParams();
  return <TabContentHost />;
}
