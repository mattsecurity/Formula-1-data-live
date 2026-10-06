import { useState } from 'react';
import type { Driver } from '../model/types';

/** Driver portrait with a team-coloured monogram fallback. */
export function Headshot({ driver, size = 40, ring = true }: { driver: Driver; size?: number; ring?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImg = driver.headshot && !failed;
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        background: `radial-gradient(120% 120% at 30% 10%, ${driver.color}, #0b0b0f 75%)`,
        boxShadow: ring ? `inset 0 0 0 1.5px ${driver.color}aa` : undefined,
      }}
    >
      {showImg ? (
        <img
          src={driver.headshot}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
        />
      ) : (
        <span style={{ fontSize: size * 0.34, fontWeight: 750, color: '#fff', letterSpacing: '-0.02em' }}>{driver.code}</span>
      )}
    </span>
  );
}
