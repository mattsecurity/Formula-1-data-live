import { Link } from 'react-router-dom';
import { DEMO_RACE_KEY } from '../api/demo';
import { Icon } from './Icon';

const LOADER_PATH =
  'M30 110 C20 80 30 40 60 30 C90 20 110 50 135 45 C160 40 170 15 200 22 C228 30 230 70 210 90 C195 105 170 95 150 108 C130 122 110 130 80 128 C55 126 38 122 30 110 Z';

export function LoadingScreen({
  label,
  progress,
  error,
  onRetry,
  title,
}: {
  label: string;
  progress: number;
  error?: Error;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-glow" />
      {!error ? (
        <>
          <div className="ld-track">
            <svg viewBox="0 0 240 150" width="260" height="162" aria-hidden>
              <defs>
                <linearGradient id="ldg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ff9f0a" />
                  <stop offset="1" stopColor="#ff375f" />
                </linearGradient>
                <filter id="ldglow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>
              <path id="ldpath" d={LOADER_PATH} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinejoin="round" />
              <path d={LOADER_PATH} fill="none" stroke="url(#ldg)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0.02, progress)} style={{ transition: 'stroke-dashoffset 0.6s var(--ease)' }} />
              {[0, 0.35, 0.7].map((delay, i) => (
                <g key={i}>
                  <circle r="7" fill={['#ff453a', '#0a84ff', '#30d158'][i]} filter="url(#ldglow)" opacity="0.8">
                    <animateMotion dur="2.4s" repeatCount="indefinite" begin={`-${delay}s`} rotate="auto">
                      <mpath href="#ldpath" />
                    </animateMotion>
                  </circle>
                  <circle r="3.6" fill="#fff">
                    <animateMotion dur="2.4s" repeatCount="indefinite" begin={`-${delay}s`}>
                      <mpath href="#ldpath" />
                    </animateMotion>
                  </circle>
                </g>
              ))}
            </svg>
            <div className="ld-pct tabular">{Math.round(progress * 100)}%</div>
          </div>
          {title && <h1 className="title-md" style={{ margin: '22px 0 6px' }}>{title}</h1>}
          <p className="muted" style={{ margin: 0 }}>{label}…</p>
          <p className="dim" style={{ maxWidth: 420, textAlign: 'center', fontSize: 13, marginTop: 18 }}>
            La prima apertura di una sessione scarica la telemetria completa di tutte le monoposto da OpenF1 e può richiedere
            circa un minuto. Le volte successive è istantanea: i dati restano salvati nel browser.
          </p>
        </>
      ) : (
        <div style={{ textAlign: 'center', maxWidth: 460, display: 'grid', gap: 14, justifyItems: 'center' }}>
          <div style={{ fontSize: 44 }}>🏁</div>
          <h1 className="title-md" style={{ margin: 0 }}>Non è stato possibile caricare la sessione</h1>
          <p className="muted" style={{ margin: 0 }}>{error.message}</p>
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>
            OpenF1 pubblica i dati storici qualche ora dopo la fine della sessione e limita le richieste troppo frequenti.
            Riprova tra qualche istante, oppure esplora la demo offline.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {onRetry && (
              <button className="btn btn-primary" onClick={onRetry}>
                <Icon name="restart" size={18} /> Riprova
              </button>
            )}
            <Link className="btn btn-secondary" to={`/replay/${DEMO_RACE_KEY}`}>
              Apri la demo
            </Link>
            <Link className="btn btn-secondary" to="/">
              Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
