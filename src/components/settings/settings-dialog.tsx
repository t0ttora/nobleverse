'use client';
import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  openSettingsDialog,
  SettingsSection
} from '@/lib/settings-dialog-events';
import SettingsContent from './settings-content';

export function SettingsDialogRoot() {
  const [open, setOpen] = React.useState(false);
  const [section, setSection] = React.useState<SettingsSection | undefined>();

  React.useEffect(() => {
    const handler = (e: any) => {
      setSection(e?.detail?.section);
      setOpen(true);
    };
    window.addEventListener('open-settings', handler as any);
    return () => window.removeEventListener('open-settings', handler as any);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Keep the chrome static; only inner content will scroll */}
      <DialogContent
        hideCloseButton
        className='max-h-[85vh] overflow-hidden p-0 sm:max-w-[1100px]'
      >
        <DialogTitle className='sr-only'>Account Settings</DialogTitle>
        <SettingsContent initialSection={section} />
      </DialogContent>
    </Dialog>
  );
}

export { openSettingsDialog };
