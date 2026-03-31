"use client";
export const dynamic = 'force-dynamic';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(() => router.push('/'))
        .catch(() => router.push('/'));
    } else {
      router.push('/');
    }
  }, []);

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#fdf8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 15,
      color: '#a08870',
    }}>
      Signing in…
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#fdf8f0' }} />}>
      <CallbackHandler />
    </Suspense>
  );
}
