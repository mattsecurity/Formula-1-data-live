import { Icon } from './Icon';

export function ErrorCard({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="card" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
      <span style={{ fontSize: 28 }}>📡</span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <b>Impossibile contattare OpenF1</b>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
          {error.message}. Controlla la connessione o riprova tra qualche secondo.
        </p>
      </div>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          <Icon name="restart" size={15} /> Riprova
        </button>
      )}
    </div>
  );
}
