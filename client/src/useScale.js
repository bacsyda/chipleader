import { useEffect, useState } from 'react';
import { scaleFor } from './layout.js';

/** Hệ số co theo cỡ màn hình; đồng thời đặt biến CSS --u (kích thước) và --e (cỡ chữ nhãn). */
export function useScale() {
  const read = () => scaleFor(window.innerWidth, window.innerHeight);
  const [u, setU] = useState(read);
  useEffect(() => {
    const on = () => setU(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--u', String(u));
    root.setProperty('--e', `${12 * Math.max(u, 0.9)}px`);
  }, [u]);
  return u;
}
