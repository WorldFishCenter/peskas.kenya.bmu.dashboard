'use client';
import { use } from 'react';
import { useIsMounted } from '@hooks/use-is-mounted';
import LithiumLayout from '@/layouts/lithium/lithium-layout';

export default function DefaultLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = use(params);
  const isMounted = useIsMounted();

  if (!isMounted) {
    return null;
  }

  return <LithiumLayout lang={lang}>{children}</LithiumLayout>;
}
