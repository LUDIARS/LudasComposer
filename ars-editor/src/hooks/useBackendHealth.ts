import { useState, useEffect, useRef } from 'react';

type HealthStatus = 'ok' | 'down' | 'checking';

const CHECK_INTERVAL = 10_000;

export function useBackendHealth(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>('checking');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        setStatus(res.ok ? 'ok' : 'down');
      } catch {
        setStatus('down');
      }
    };

    check();
    timerRef.current = setInterval(check, CHECK_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return status;
}
