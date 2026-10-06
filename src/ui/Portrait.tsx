import { useState } from 'react';
import type { Driver } from '../model/types';
import { headshotCandidates } from './headshotUrls';

/** Full official portrait (transparent PNG from F1), bottom-anchored; monogram fallback. */
export function Portrait({ driver, className }: { driver: Driver; className?: string }) {
  const urls = headshotCandidates(driver.headshot, true);
  const [i, setI] = useState(0);
  if (i >= urls.length)
    return (
      <div className={`portrait-fallback ${className ?? ''}`} aria-hidden>
        <span>{driver.code}</span>
      </div>
    );
  return <img className={className} src={urls[i]} alt={driver.full} loading="lazy" referrerPolicy="no-referrer" onError={() => setI((v) => v + 1)} />;
}
