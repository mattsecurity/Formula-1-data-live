import { motion } from 'framer-motion';
import { useId } from 'react';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`segmented ${className ?? ''}`} role="group" aria-label={label} style={{ isolation: 'isolate' }}>
      {options.map((o) => (
        <button key={String(o.value)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="seg-thumb"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
