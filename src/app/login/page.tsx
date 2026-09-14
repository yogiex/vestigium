import type { Metadata } from 'next';

import { LoginView } from '@/components/app/login-view';

export const metadata: Metadata = { title: 'Masuk — Vestigium' };

export default function LoginPage() {
  return <LoginView />;
}
