'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Hydration guard (CC-33) — zustand persist mengisi SETELAH mount; prerender statis kosong.
 *  useSyncExternalStore: false saat SSR/prerender, true di klien — tanpa setState dalam effect. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
