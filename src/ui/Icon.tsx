import type { SVGProps } from 'react';

// SF-Symbols-inspired line icons (24×24, 1.8 stroke).
const PATHS: Record<string, string> = {
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z',
  pause: 'M7 5h3.2v14H7zM13.8 5H17v14h-3.2z',
  back10: 'M11 6 6 10l5 4M6 10h8a5 5 0 1 1-4.6 7',
  fwd10: 'M13 6l5 4-5 4M18 10h-8a5 5 0 1 0 4.6 7',
  restart: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  close: 'M6 6l12 12M18 6 6 18',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gauge: 'M12 14l4-6M4.5 18a9 9 0 1 1 15 0',
  layers: 'M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  radio: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01',
  thermometer: 'M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z',
  drop: 'M12 3s6 6.4 6 11a6 6 0 1 1-12 0c0-4.6 6-11 6-11z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
  rain: 'M7 17l-1 3M12 17l-1 3M17 17l-1 3M6.5 14A4.5 4.5 0 1 1 8 5.3 6 6 0 0 1 19.5 9 3.5 3.5 0 0 1 18 14z',
  car: 'M3 15l2-5h3l2-3h4l2 3h3l2 5v3h-3M3 15v3h3M9 18h6M6 18a2 2 0 1 0 0-.01M18 18a2 2 0 1 0 0-.01',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM16 6h3a3 3 0 0 1-3 4M8 6H5a3 3 0 0 0 3 4M12 13v4M8 21h8M9 17h6',
  calendar: 'M4 6h16v15H4zM4 10h16M9 3v4M15 3v4',
  home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  stopwatch: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2h4M19 5l1.5-1.5',
  pit: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  speaker: 'M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  rotate: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5',
  zoomIn: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5M11 8v6M8 11h6',
  zoomOut: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5M8 11h6',
  crosshair: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 2v5M12 17v5M2 12h5M17 12h5',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  github:
    'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  filled,
  ...rest
}: { name: IconName; size?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  const fill = filled || name === 'play' || name === 'pause';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
