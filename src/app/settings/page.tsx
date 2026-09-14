import type { Metadata } from 'next';

import { SettingsView } from '@/components/app/settings-view';

export const metadata: Metadata = { title: 'Pengaturan — Vestigium' };

export default function SettingsPage() {
  return <SettingsView />;
}
