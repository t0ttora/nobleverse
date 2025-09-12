'use client';

import PageContainer from '@/components/layout/page-container';
import React from 'react';
import { supabase } from '../../../utils/supabase/client';
import { useProfileRole } from '@/hooks/use-profile-role';
import {
  ShipperDashboard,
  ForwarderDashboard,
  CustomsOfficerDashboard,
  ReceiverDashboard
} from '@/components/dashboard/role-dashboards';

// Helper to extract first name like in user-nav
function getFirstNameFromUser(user: any): string {
  const meta = user?.user_metadata || {};
  const firstName: string =
    meta.first_name ||
    meta.given_name ||
    (meta.name ? String(meta.name).split(' ')[0] : '');
  return firstName || '';
}

export default function OverViewLayout() {
  const [userId, setUserId] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const { role } = useProfileRole();

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      setUserId(user?.id || '');
      const first = getFirstNameFromUser(user);
      setFirstName(first);
    });
  }, []);

  return (
    <>
      <PageContainer>
        <div className='y-2 x-2 flex flex-1 flex-col space-y-2'>
          <div className='flex w-full justify-start'>
            <div className='mt-2 mb-4 flex items-center gap-2 text-2xl font-bold'>
              <span>
                Welcome back, {firstName || 'there'}!{' '}
                <span role='img' aria-label='waving hand'>
                  👋
                </span>
              </span>
            </div>
          </div>
          {role === 'forwarder' && <ForwarderDashboard />}
          {role === 'shipper' && <ShipperDashboard userId={userId} />}
          {/* For demo, map customs officer and receiver via unknown/other roles */}
          {role === 'other' && <ReceiverDashboard />}
          {role === 'carrier' && <ForwarderDashboard />}
          {role === 'broker' && <ForwarderDashboard />}
        </div>
      </PageContainer>
    </>
  );
}
