import { useEffect } from 'react';
import { useRouter } from 'next/router';

// T014: Redirect legacy /register to split-panel auth page at /login?tab=register
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    void router.replace('/login');
  }, [router]);
  return null;
}
