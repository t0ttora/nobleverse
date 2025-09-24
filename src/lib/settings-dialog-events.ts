export type SettingsSection =
  | 'my-details'
  | 'profile'
  | 'password'
  | 'team'
  | 'plan'
  | 'billing'
  | 'email'
  | 'notifications'
  | 'integrations'
  | 'api';

export function openSettingsDialog(section?: SettingsSection) {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent('open-settings', {
    detail: { section }
  });
  window.dispatchEvent(event);
}
