// src/components/tour/useIsDesktop.js
import { useEffect, useState } from 'react';

/** Tracks whether the viewport is at/above the `md` breakpoint (768px). */
export const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    const checkWidth = () => setIsDesktop(window.innerWidth >= 768);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return isDesktop;
};
