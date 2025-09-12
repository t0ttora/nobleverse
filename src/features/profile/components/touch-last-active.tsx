'use client';
import { useEffect } from 'react';

export default function TouchLastActive() {
  useEffect(() => {
    fetch('/api/profile/touch', { method: 'POST' }).catch(() => {});
  }, []);
  return null;
}
