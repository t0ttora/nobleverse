'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Role } from '@/types/profile';

export function useProfileRole() {
  const [role, setRole] = useState<Role | 'unknown' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        setRole('unknown');
      } else {
        setRole((data?.role as Role) ?? 'unknown');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRole();
    const onRoleChanged = () => {
      if (!cancelled) fetchRole();
    };
    window.addEventListener(
      'profile-role-changed',
      onRoleChanged as EventListener
    );
    return () => {
      cancelled = true;
      window.removeEventListener(
        'profile-role-changed',
        onRoleChanged as EventListener
      );
    };
  }, [fetchRole]);

  return { role, loading, refetch: fetchRole };
}
