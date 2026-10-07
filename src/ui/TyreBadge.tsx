import { COMPOUND_COLORS, COMPOUND_LETTER, COMPOUND_NAME_IT } from '../model/constants';
import type { Compound } from '../model/types';

export function TyreBadge({ compound, size = 20, age }: { compound: Compound; size?: number; age?: number }) {
  const c = COMPOUND_COLORS[compound];
  const label = `${COMPOUND_NAME_IT[compound]}${age != null ? `, ${age} giri` : ''}`;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={label} aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#111" />
        <circle cx="10" cy="10" r="7" fill="none" stroke={c} strokeWidth="2.6" />
        <text x="10" y="13.6" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff" fontFamily="var(--font)">
          {COMPOUND_LETTER[compound]}
        </text>
      </svg>
      {age != null && (
        <span className="tabular" style={{ fontSize: 11, color: 'var(--text-3)', minWidth: 14 }}>
          {age}
        </span>
      )}
    </span>
  );
}
