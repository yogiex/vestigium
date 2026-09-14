'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useHasMounted } from './use-has-mounted';
import { useVestigium } from '@/store/use-vestigium';
import type { Person } from '@/lib/types';

/** Gerbang identitas operator: tanpa operator aktif → paksa ke /login.
 *  Mengunci UI, bukan data (L1 tanpa server — lihat README Model Kepercayaan). */
export function useOperatorGuard(): { mounted: boolean; operator: Person | null } {
  const mounted = useHasMounted();
  const router = useRouter();
  const operator = useVestigium(
    s => s.persons.find(p => p.id === s.settings.defaultExaminerId) ?? null,
  );
  useEffect(() => {
    if (mounted && !operator) router.replace('/login');
  }, [mounted, operator, router]);
  return { mounted, operator };
}
